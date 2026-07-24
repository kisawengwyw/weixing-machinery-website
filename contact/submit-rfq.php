<?php
declare(strict_types=1);
error_reporting(0);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

const MAX_FILES = 5;
const MAX_FILE_SIZE = 8388608;
const MAX_TOTAL_SIZE = 20971520;
const MIN_SECONDS = 3;
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600;
const RECIPIENT = 'kisaweng@outlook.com';
$allowedExt = ['pdf','jpg','jpeg','png','step','stp','iges','igs','dwg','dxf','zip'];
$blockedExt = ['php','phtml','phar','exe','js','html','htaccess','svg','sh','bat','cmd','com','scr','msi','jar','ps1','vb','vbs'];
$allowedMime = ['application/pdf','image/jpeg','image/png','application/zip','application/x-zip-compressed','application/octet-stream','model/step','model/iges','image/vnd.dwg','image/vnd.dxf','application/acad','application/x-acad','application/autocad_dwg','application/dwg','application/dxf','text/plain'];

function respond(int $code, array $payload): void { http_response_code($code); echo json_encode($payload, JSON_UNESCAPED_UNICODE); exit; }
function clean(string $v, int $max): string { $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v)); return mb_substr($v, 0, $max, 'UTF-8'); }
function header_safe(string $v): string { return str_replace(["\r","\n"], '', $v); }
function reference(): string { return 'WX-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(2))); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['success'=>false,'message'=>'POST required.']);
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin && $host && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, ['success'=>false,'message'=>'Request origin rejected.']);
if (!empty($_POST['website'])) respond(400, ['success'=>false,'message'=>'RFQ rejected.']);
$loaded = (int)($_POST['loaded_at'] ?? 0);
if ($loaded <= 0 || time() - $loaded < MIN_SECONDS) respond(429, ['success'=>false,'message'=>'Please review the form before submitting.']);

$ip = preg_replace('/[^0-9a-fA-F:\.]/', '', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = sys_get_temp_dir() . '/wx_rfq_' . hash('sha256', $ip) . '.json';
$now = time(); $hits = [];
if (is_file($rateFile)) { $hits = json_decode((string)file_get_contents($rateFile), true) ?: []; }
$hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - RATE_WINDOW));
if (count($hits) >= RATE_LIMIT) respond(429, ['success'=>false,'message'=>'Too many RFQ submissions.']);
$hits[] = $now; @file_put_contents($rateFile, json_encode($hits), LOCK_EX);

$fields = [
 'name'=>clean($_POST['name'] ?? '', 120), 'company'=>clean($_POST['company'] ?? '', 160), 'email'=>clean($_POST['email'] ?? '', 180),
 'phone'=>clean($_POST['phone'] ?? '', 80), 'country'=>clean($_POST['country'] ?? '', 100), 'product_category'=>clean($_POST['product_category'] ?? '', 100),
 'part_number'=>clean($_POST['part_number'] ?? '', 160), 'quantity'=>clean($_POST['quantity'] ?? '', 120), 'material'=>clean($_POST['material'] ?? '', 180),
 'requirements'=>clean($_POST['requirements'] ?? '', 3000)
];
foreach (['name','company','email','product_category','requirements'] as $r) if ($fields[$r] === '') respond(422, ['success'=>false,'message'=>'Missing required fields.']);
if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) respond(422, ['success'=>false,'message'=>'Invalid email address.']);

$ref = reference();
$attachments = []; $fileLines = []; $total = 0;
if (isset($_FILES['files'])) {
 $names = $_FILES['files']['name']; $count = is_array($names) ? count($names) : 0;
 if ($count > MAX_FILES) respond(422, ['success'=>false,'message'=>'Too many files.']);
 $finfo = new finfo(FILEINFO_MIME_TYPE);
 for ($i=0; $i<$count; $i++) {
  if ($_FILES['files']['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
  if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) respond(422, ['success'=>false,'message'=>'File upload failed.']);
  $original = basename((string)$_FILES['files']['name'][$i]);
  if (!preg_match('/^[\w .()+,\-\[\]]{1,180}$/u', $original) || substr_count($original, '.') !== 1) respond(422, ['success'=>false,'message'=>'Suspicious file name rejected.']);
  $parts = explode('.', $original); $ext = strtolower(end($parts));
  if (in_array($ext, $blockedExt, true) || !in_array($ext, $allowedExt, true)) respond(422, ['success'=>false,'message'=>'File type rejected.']);
  $size = (int)$_FILES['files']['size'][$i]; $total += $size;
  if ($size > MAX_FILE_SIZE) respond(422, ['success'=>false,'message'=>'A file exceeds 8 MB.']);
  if ($total > MAX_TOTAL_SIZE) respond(422, ['success'=>false,'message'=>'Total file size exceeds 20 MB.']);
  $mime = $finfo->file($_FILES['files']['tmp_name'][$i]) ?: 'application/octet-stream';
  if (!in_array($mime, $allowedMime, true)) respond(422, ['success'=>false,'message'=>'File content type rejected.']);
  $internal = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'wxrfq_' . bin2hex(random_bytes(16)) . '.' . $ext;
  if (!move_uploaded_file($_FILES['files']['tmp_name'][$i], $internal)) respond(500, ['success'=>false,'message'=>'Unable to process uploaded file.']);
  $attachments[] = ['path'=>$internal,'name'=>$original,'mime'=>$mime]; $fileLines[] = $original . ' (' . $size . ' bytes, ' . $mime . ')';
 }
}
$configPath = dirname($_SERVER['DOCUMENT_ROOT'] ?? __DIR__) . '/rfq-config.php';
if (!is_file($configPath)) respond(503, ['success'=>false,'reference'=>$ref,'message'=>'RFQ mail service is not configured. Please use email or WhatsApp.']);
$config = require $configPath;
$fromEmail = filter_var($config['from_email'] ?? '', FILTER_VALIDATE_EMAIL);
$fromName = header_safe((string)($config['from_name'] ?? 'Wei Xing Machinery RFQ'));
$toEmail = filter_var($config['to_email'] ?? RECIPIENT, FILTER_VALIDATE_EMAIL) ?: RECIPIENT;
$tempDir = (string)($config['temp_dir'] ?? sys_get_temp_dir());
if (!$fromEmail || !is_dir($tempDir) || !is_writable($tempDir)) respond(503, ['success'=>false,'reference'=>$ref,'message'=>'RFQ mail service is not configured. Please use email or WhatsApp.']);

$subject = header_safe('[Website RFQ] [' . $ref . '] ' . $fields['product_category'] . ' - ' . $fields['company']);
$body = "Reference: $ref\n"; foreach ($fields as $k=>$v) $body .= ucfirst(str_replace('_',' ', $k)) . ": " . $v . "\n"; $body .= "Files:\n" . ($fileLines ? implode("\n", $fileLines) : 'No files uploaded') . "\n";
$boundary = 'WXRFQ_' . bin2hex(random_bytes(12));
$headers = ['From: ' . $fromName . ' <' . header_safe($fromEmail) . '>','Reply-To: ' . header_safe($fields['email']),'MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="' . $boundary . '"'];
$message = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
foreach ($attachments as $a) { $message .= "--$boundary\r\nContent-Type: {$a['mime']}; name=\"" . header_safe($a['name']) . "\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . header_safe($a['name']) . "\"\r\n\r\n" . chunk_split(base64_encode((string)file_get_contents($a['path']))) . "\r\n"; }
$message .= "--$boundary--";
$sent = @mail($toEmail, $subject, $message, implode("\r\n", $headers));
foreach ($attachments as $a) { @unlink($a['path']); }
if (!$sent) respond(502, ['success'=>false,'message'=>'RFQ email could not be sent. Please use email or WhatsApp.']);
respond(200, ['success'=>true,'reference'=>$ref]);
