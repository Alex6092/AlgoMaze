<?php
defined('MOODLE_INTERNAL') || die();
$string['modulename'] = 'Algomaze validation';
$string['modulenameplural'] = 'Algomaze validation';
$string['pluginname'] = 'Algomaze validation';
$string['modulename_help'] = 'Use Algomaze validation to integrate algomaze';
$string['name'] = 'Activity name';
$string['levelnumber'] = 'Level number';
$string['maximumchars'] = 'Maximum allowed characters is {$a}.';
$string['startactivity'] = 'Start Activity';
$string['completion_auto'] = 'Automatic completion';
$string['settingbaseurl'] = 'AlgoMaze base URL';
$string['settingbaseurl_desc'] = 'URL where the AlgoMaze application is hosted, without trailing slash (e.g. https://algomaze.example.com).';
$string['settingsharedsecret'] = 'Shared SSO secret';
$string['settingsharedsecret_desc'] = 'HMAC secret shared with the AlgoMaze server (MOODLE_SHARED_SECRET environment variable). Must match exactly.';
$string['ssomisconfigured'] = 'SSO not configured: missing AlgoMaze base URL or shared secret. Please contact the Moodle administrator.';
$string['levelcompleted'] = '✓ Level completed. You can revisit AlgoMaze to retry it and improve your badge.';
$string['levelpending'] = '⏳ Level {$a} not completed yet. Click the button below to open AlgoMaze (automatic login).';
$string['opensinnewtab'] = 'AlgoMaze opens in a new tab. Come back to this page and refresh it to see the updated status.';