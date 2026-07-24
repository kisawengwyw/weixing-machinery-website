<?php
return [
    // Create and verify a same-domain mailbox on Hostinger before production use.
    'from_email' => getenv('RFQ_FROM_EMAIL') ?: 'rfq@weixingmachinery.com',
    'from_name' => 'Wei Xing Machinery RFQ',
    'to_email' => getenv('RFQ_TO_EMAIL') ?: 'kisaweng@outlook.com',
    // Optional: set to a non-public directory outside public_html. Defaults to system temp.
    'temp_dir' => getenv('RFQ_TEMP_DIR') ?: sys_get_temp_dir(),
    // This endpoint uses PHP mail(). Configure Hostinger mail transport for the from_email domain.
];
