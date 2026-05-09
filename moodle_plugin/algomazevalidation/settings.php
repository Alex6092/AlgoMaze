<?php
// Réglages d'administration pour mod_algomazevalidation.
// Accessible depuis : Administration du site > Plugins > Activités > Algomaze validation.

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {

    $settings->add(new admin_setting_configtext(
        'mod_algomazevalidation/baseurl',
        get_string('settingbaseurl', 'algomazevalidation'),
        get_string('settingbaseurl_desc', 'algomazevalidation'),
        'https://algomaze.tspro.fr',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'mod_algomazevalidation/sharedsecret',
        get_string('settingsharedsecret', 'algomazevalidation'),
        get_string('settingsharedsecret_desc', 'algomazevalidation'),
        ''
    ));
}
