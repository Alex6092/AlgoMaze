<?php
// Vue d'une activité Algomaze validation : redirige l'étudiant vers AlgoMaze
// avec une URL signée HMAC pour l'authentifier automatiquement (SSO).

require_once('../../config.php');
require_once($CFG->dirroot.'/mod/algomazevalidation/lib.php');

$id = optional_param('id', 0, PARAM_INT); // Course Module ID
$n  = optional_param('n', 0, PARAM_INT);  // algomazevalidation instance ID

if ($id) {
    $cm = get_coursemodule_from_id('algomazevalidation', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
    $algomazevalidation = $DB->get_record('algomazevalidation', array('id' => $cm->instance), '*', MUST_EXIST);
} else if ($n) {
    $algomazevalidation = $DB->get_record('algomazevalidation', array('id' => $n), '*', MUST_EXIST);
    $course = $DB->get_record('course', array('id' => $algomazevalidation->course), '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('algomazevalidation', $algomazevalidation->id, $course->id, false, MUST_EXIST);
} else {
    print_error('You must specify a course_module ID or an instance ID');
}

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
$PAGE->set_url('/mod/algomazevalidation/view.php', array('id' => $cm->id));
$PAGE->set_title(format_string($algomazevalidation->name));
$PAGE->set_heading(format_string($course->fullname));

// Met à jour l'état de complétion (vue) - inchangé.
$completion = new completion_info($course);
if ($completion->is_enabled($cm)) {
    $completion->set_module_viewed($cm);
}

// Récupère la configuration SSO du plugin.
$baseurl = trim((string)get_config('mod_algomazevalidation', 'baseurl'));
$secret = (string)get_config('mod_algomazevalidation', 'sharedsecret');

// Si la config est incomplète, on affiche un message clair sans redirect.
if (empty($baseurl) || empty($secret)) {
    echo $OUTPUT->header();
    echo $OUTPUT->notification(
        get_string('ssomisconfigured', 'algomazevalidation'),
        \core\output\notification::NOTIFY_ERROR
    );
    echo $OUTPUT->footer();
    exit;
}

// Construit l'URL signée vers AlgoMaze.
// Payload signé : "username:level:timestamp" (cohérent avec la route /sso/from-moodle côté AlgoMaze).
$baseurl = rtrim($baseurl, '/');
$username = strtolower($USER->username);
$levelnumber = (int)$algomazevalidation->levelnumber;
$timestamp = time();
$payload = $username . ':' . $levelnumber . ':' . $timestamp;
$signature = hash_hmac('sha256', $payload, $secret);

$ssourl = $baseurl . '/sso/from-moodle?'
    . 'username=' . rawurlencode($username)
    . '&level=' . $levelnumber
    . '&timestamp=' . $timestamp
    . '&signature=' . $signature;

redirect(new moodle_url($ssourl));
