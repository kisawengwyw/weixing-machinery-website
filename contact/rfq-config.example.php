<?php
// Copy this file to rfq-config.php one level above public_html.
// Keep the real SMTP password only in that non-public rfq-config.php file.
// Never commit real mailbox passwords, SMTP passwords, or production rfq-config.php to GitHub.
return [
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_secure' => 'smtps',
    'smtp_username' => 'rfq@weixingmachinery.com',
    'smtp_password' => 'CHANGE_ME',
    'from_email' => 'rfq@weixingmachinery.com',
    'from_name' => 'Wei Xing Machinery RFQ',
    'to_email' => 'kisaweng@outlook.com',
    'temp_dir' => '/absolute/private/path/outside/public_html/rfq-temp',
];
