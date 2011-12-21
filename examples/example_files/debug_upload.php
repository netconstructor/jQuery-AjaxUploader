<?php

header('Content-Type: application/json');
echo json_encode(array('test'=>print_r($_FILES,true)));
