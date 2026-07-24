<?php
declare(strict_types=1);
error_reporting(0);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

const MAX_FILES = 5;
const MAX_FILE_SIZE = 8388608;
const MAX_TOTAL_SIZE = 12582912;
const MIN_SECONDS = 3;
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600;
const RECIPIENT = 'kisaweng@outlook.com';

$allowedExt = ['pdf','jpg','jpeg','png','step','stp','iges','igs','dwg','dxf','zip'];
$blockedExt = ['php','phtml','phar','exe','js','html','htaccess','svg','sh','bat','cmd','com','scr','msi','jar','ps1','vb','vbs'];
$mimeByExt = [
    'pdf'=>['application/pdf'],
    'jpg'=>['image/jpeg'], 'jpeg'=>['image/jpeg'],
    'png'=>['image/png'],
    'zip'=>['application/zip','application/x-zip-compressed'],
    'step'=>['model/step','application/step','application/STEP','application/octet-stream','text/plain'],
    'stp'=>['model/step','application/step','application/STEP','application/octet-stream','text/plain'],
    'iges'=>['model/iges','application/iges','application/IGES','application/octet-stream','text/plain'],
    'igs'=>['model/iges','application/iges','application/IGES','application/octet-stream','text/plain'],
    'dwg'=>['image/vnd.dwg','application/acad','application/x-acad','application/autocad_dwg','application/dwg','application/octet-stream'],
    'dxf'=>['image/vnd.dxf','application/dxf','application/octet-stream','text/plain'],
];
$attachments = [];
register_shutdown_function(function () use (&$attachments): void {
    foreach ($attachments as $attachment) {
        if (isset($attachment['path']) && is_file($attachment['path'])) {
            @unlink($attachment['path']);
        }
    }
});

function respond(int $code, string $errorCode, array $extra = []): void {
    http_response_code($code);
    echo json_encode(array_merge(['success'=>false,'error'=>$errorCode], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}
function success(string $reference): void { http_response_code(200); echo json_encode(['success'=>true,'reference'=>$reference], JSON_UNESCAPED_UNICODE); exit; }
function clean(string $value, int $max): string { $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value)); return mb_substr($value, 0, $max, 'UTF-8'); }
function header_safe(string $value): string { return str_replace(["\r", "\n"], '', $value); }
function reference(): string { return 'WX-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(2))); }
function is_under(string $path, string $parent): bool { $path = rtrim($path, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR; $parent = rtrim($parent, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR; return strncmp($path, $parent, strlen($parent)) === 0; }
function has_bad_signature(string $path): bool {
    $chunk = (string)file_get_contents($path, false, null, 0, 512);
    $trimmed = ltrim($chunk);
    return str_starts_with($chunk, "MZ") || str_starts_with($chunk, "\x7FELF") || preg_match('/<\?(php|=)?/i', $chunk) === 1 || preg_match('/^#!\s*\/(bin|usr\/bin|usr\/env)/', $trimmed) === 1 || preg_match('/<(html|script|body|iframe)\b/i', $chunk) === 1 || preg_match('/\b(function|eval|document\.write|window\.)\s*[\(=]/i', $chunk) === 1;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, 'METHOD_NOT_ALLOWED');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin && $host && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, 'ORIGIN_REJECTED');
if (!empty($_POST['website'])) respond(400, 'SPAM_REJECTED');
$loaded = (int)($_POST['loaded_at'] ?? 0);
if ($loaded <= 0 || time() - $loaded < MIN_SECONDS) respond(429, 'TOO_FAST');

$fields = [
    'name'=>clean($_POST['name'] ?? '', 120), 'company'=>clean($_POST['company'] ?? '', 160), 'email'=>clean($_POST['email'] ?? '', 180),
    'phone'=>clean($_POST['phone'] ?? '', 80), 'country'=>clean($_POST['country'] ?? '', 100), 'product_category'=>clean($_POST['product_category'] ?? '', 100),
    'part_number'=>clean($_POST['part_number'] ?? '', 160), 'quantity'=>clean($_POST['quantity'] ?? '', 120), 'material'=>clean($_POST['material'] ?? '', 180),
    'requirements'=>clean($_POST['requirements'] ?? '', 3000)
];
foreach (['name','company','email','product_category','requirements'] as $required) {
    if ($fields[$required] === '') respond(422, 'MISSING_FIELDS');
}
if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) respond(422, 'INVALID_EMAIL');

$configPath = dirname($_SERVER['DOCUMENT_ROOT'] ?? __DIR__) . '/rfq-config.php';
if (!is_file($configPath)) respond(503, 'MAIL_NOT_CONFIGURED', ['reference'=>reference()]);
$config = require $configPath;
$fromEmail = filter_var($config['from_email'] ?? '', FILTER_VALIDATE_EMAIL);
$fromName = header_safe((string)($config['from_name'] ?? 'Wei Xing Machinery RFQ'));
$toEmail = filter_var($config['to_email'] ?? RECIPIENT, FILTER_VALIDATE_EMAIL) ?: RECIPIENT;
$tempDir = realpath((string)($config['temp_dir'] ?? ''));
$docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
if (!$fromEmail || !$tempDir || !is_dir($tempDir) || !is_writable($tempDir) || ($docRoot && is_under($tempDir, $docRoot))) {
    respond(503, 'MAIL_NOT_CONFIGURED', ['reference'=>reference()]);
}

$fileQueue = []; $fileLines = []; $total = 0;
if (isset($_FILES['files'])) {
    $count = is_array($_FILES['files']['name']) ? count($_FILES['files']['name']) : 0;
    if ($count > MAX_FILES) respond(422, 'TOO_MANY_FILES');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    for ($i = 0; $i < $count; $i++) {
        if ($_FILES['files']['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) respond(422, 'FILE_TYPE_REJECTED');
        $original = basename((string)$_FILES['files']['name'][$i]);
        if ($original === '' || strlen($original) > 180 || preg_match('/[\x00-\x1F\x7F\\\/]/', $original)) respond(422, 'FILE_NAME_REJECTED');
        $segments = explode('.', $original);
        if (count($segments) < 2 || in_array('', $segments, true)) respond(422, 'FILE_NAME_REJECTED');
        $ext = strtolower(array_pop($segments));
        if (!in_array($ext, $allowedExt, true)) respond(422, 'FILE_TYPE_REJECTED');
        foreach ($segments as $segment) {
            $candidate = strtolower($segment);
            if (in_array($candidate, $blockedExt, true)) respond(422, 'FILE_NAME_REJECTED');
        }
        $size = (int)$_FILES['files']['size'][$i]; $total += $size;
        if ($size > MAX_FILE_SIZE) respond(422, 'FILE_TOO_LARGE');
        if ($total > MAX_TOTAL_SIZE) respond(422, 'TOTAL_TOO_LARGE');
        $tmp = (string)$_FILES['files']['tmp_name'][$i];
        $mime = $finfo->file($tmp) ?: 'application/octet-stream';
        if (!in_array($mime, $mimeByExt[$ext] ?? [], true)) respond(422, 'FILE_TYPE_REJECTED');
        if (in_array($mime, ['application/octet-stream','text/plain'], true) && has_bad_signature($tmp)) respond(422, 'FILE_TYPE_REJECTED');
        $fileQueue[] = ['tmp'=>$tmp, 'name'=>$original, 'ext'=>$ext, 'mime'=>$mime, 'size'=>$size];
        $fileLines[] = $original . ' (' . $size . ' bytes, ' . $mime . ')';
    }
}

$ip = preg_replace('/[^0-9a-fA-F:\.]/', '', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = sys_get_temp_dir() . '/wx_rfq_' . hash('sha256', $ip) . '.json';
$now = time(); $hits = [];
if (is_file($rateFile)) { $hits = json_decode((string)file_get_contents($rateFile), true) ?: []; }
$hits = array_values(array_filter($hits, fn($time) => is_int($time) && $time > $now - RATE_WINDOW));
if (count($hits) >= RATE_LIMIT) respond(429, 'RATE_LIMITED');

foreach ($fileQueue as $file) {
    $internal = rtrim($tempDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'wxrfq_' . bin2hex(random_bytes(16)) . '.' . $file['ext'];
    if (!move_uploaded_file($file['tmp'], $internal)) respond(500, 'FILE_TYPE_REJECTED');
    $attachments[] = ['path'=>$internal, 'name'=>$file['name'], 'mime'=>$file['mime']];
}
$hits[] = $now; @file_put_contents($rateFile, json_encode($hits), LOCK_EX);

$ref = reference();
$subject = header_safe('[Website RFQ] [' . $ref . '] ' . $fields['product_category'] . ' - ' . $fields['company']);
$body = "Reference: $ref\n";
foreach ($fields as $key => $value) { $body .= ucfirst(str_replace('_', ' ', $key)) . ": " . $value . "\n"; }
$body .= "Files:\n" . ($fileLines ? implode("\n", $fileLines) : 'No files uploaded') . "\n";
$boundary = 'WXRFQ_' . bin2hex(random_bytes(12));
$headers = ['From: ' . $fromName . ' <' . header_safe($fromEmail) . '>', 'Reply-To: ' . header_safe($fields['email']), 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' . $boundary . '"'];
$message = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
foreach ($attachments as $attachment) {
    $message .= "--$boundary\r\nContent-Type: {$attachment['mime']}; name=\"" . header_safe($attachment['name']) . "\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . header_safe($attachment['name']) . "\"\r\n\r\n" . chunk_split(base64_encode((string)file_get_contents($attachment['path']))) . "\r\n";
}
$message .= "--$boundary--";
if (!@mail($toEmail, $subject, $message, implode("\r\n", $headers))) respond(502, 'MAIL_SEND_FAILED');
success($ref);
