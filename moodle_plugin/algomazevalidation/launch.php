<?php
// Point d'entrée du bouton « Aller sur Algomaze ».
//
// Génère l'URL SSO signée AU MOMENT DU CLIC, puis redirige vers AlgoMaze.
// Avant la v1.4, l'URL était signée au rendu de la page d'activité (view.php) : si
// l'étudiant lisait la consigne plus longtemps que la fenêtre anti-rejeu côté
// AlgoMaze (60 s à l'époque), le lien était déjà expiré au moment du clic et la
// connexion échouait. Ici, l'horodatage est frais quel que soit le temps passé
// sur la page Moodle.

require_once('../../config.php');
require_once($CFG->dirroot.'/mod/algomazevalidation/lib.php');

$id = required_param('id', PARAM_INT); // Course Module ID

$cm = get_coursemodule_from_id('algomazevalidation', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$algomazevalidation = $DB->get_record('algomazevalidation', array('id' => $cm->instance), '*', MUST_EXIST);

require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/algomazevalidation:view', $context);

// Un invité Moodle n'a pas d'identité exploitable côté AlgoMaze (le compte « guest »
// serait partagé par tous les visiteurs).
if (isguestuser()) {
    throw new moodle_exception('noguest');
}

$PAGE->set_url('/mod/algomazevalidation/launch.php', array('id' => $cm->id));
$PAGE->set_context($context);

$baseurl = trim((string)get_config('mod_algomazevalidation', 'baseurl'));
$secret = (string)get_config('mod_algomazevalidation', 'sharedsecret');
if (empty($baseurl) || empty($secret)) {
    throw new moodle_exception('ssomisconfigured', 'algomazevalidation');
}

$ssourl = algomazevalidation_build_sso_url($baseurl, $secret, $USER, (int)$algomazevalidation->levelnumber);
redirect(new moodle_url($ssourl));
