<?php
defined('MOODLE_INTERNAL') || die();

$capabilities = array(
    'mod/algomazevalidation:view' => array(
        'captype' => 'read',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes' => array(
            'student' => CAP_ALLOW,
            'guest' => CAP_PREVENT,
        ),
        'default' => CAP_ALLOW,
    ),
    'mod/algomazevalidation:manage' => array(
        'captype' => 'write',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes' => array(
            'editingteacher' => CAP_ALLOW,
            'teacher' => CAP_ALLOW,
            'manager' => CAP_ALLOW,
        ),
        'default' => CAP_ALLOW,
    ),
    'mod/algomaze_validation:complete' => array(
        'captype' => 'write',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes' => array(
            'guest' => CAP_PREVENT,
            'student' => CAP_ALLOW,
            'editingteacher' => CAP_ALLOW,
            'teacher' => CAP_ALLOW,
            'manager' => CAP_ALLOW
        )
    ),
);

