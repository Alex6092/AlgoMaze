<?php
// Vue d'une activité Algomaze validation : affiche la page Moodle avec
//  - le statut de complétion (terminé / non terminé) calculé en appelant AlgoMaze
//  - un bouton qui ouvre AlgoMaze dans un nouvel onglet via une URL signée HMAC (SSO)
//
// On n'utilise PLUS de redirection automatique : sans page Moodle visible,
// l'étudiant ne voyait jamais le statut et le hook de complétion ne se
// déclenchait pas (Moodle l'appelle au chargement d'une vue d'activité).

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

// Récupère la configuration SSO du plugin.
$baseurl = trim((string)get_config('mod_algomazevalidation', 'baseurl'));
$secret = (string)get_config('mod_algomazevalidation', 'sharedsecret');

// Statut de complétion (appel direct au serveur AlgoMaze pour avoir l'état le plus à jour).
$levelnumber = (int)$algomazevalidation->levelnumber;
$iscompleted = !empty($baseurl) ? external_site_check_completion($USER->id, $levelnumber) : false;

// Met à jour l'état de complétion Moodle :
//   - set_module_viewed enregistre la visite (utile si le critère "vue" est actif),
//     mais ne ré-évalue les règles custom qu'au PREMIER affichage (il sort tôt si
//     l'activité est déjà marquée comme vue).
//   - update_state force la ré-évaluation de notre règle custom (qui appelle
//     /check_completion côté AlgoMaze) à CHAQUE chargement de la page : c'est ce
//     qui permet à l'étudiant de voir l'activité passer en "terminée" après avoir
//     validé son niveau, simplement en rafraîchissant la page Moodle.
$completion = new completion_info($course);
if ($completion->is_enabled($cm)) {
    $completion->set_module_viewed($cm);
    $completion->update_state(
        $cm,
        $iscompleted ? COMPLETION_COMPLETE : COMPLETION_INCOMPLETE
    );
}

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($algomazevalidation->name));

// Description / intro de l'activité saisie par l'enseignant.
if (!empty($algomazevalidation->intro)) {
    echo $OUTPUT->box(
        format_module_intro('algomazevalidation', $algomazevalidation, $cm->id),
        'generalbox mod_introbox'
    );
}

// Si la config est incomplète, on affiche un message clair et on s'arrête là.
if (empty($baseurl) || empty($secret)) {
    echo $OUTPUT->notification(
        get_string('ssomisconfigured', 'algomazevalidation'),
        \core\output\notification::NOTIFY_ERROR
    );
    echo $OUTPUT->footer();
    exit;
}

if ($iscompleted) {
    echo $OUTPUT->notification(
        get_string('levelcompleted', 'algomazevalidation'),
        \core\output\notification::NOTIFY_SUCCESS
    );
} else {
    echo $OUTPUT->notification(
        get_string('levelpending', 'algomazevalidation', $levelnumber),
        \core\output\notification::NOTIFY_INFO
    );
}

// Construit l'URL signée vers AlgoMaze (SSO HMAC).
// Payload signé : "username:level:timestamp" (cohérent avec la route /sso/from-moodle côté AlgoMaze).
$baseurl = rtrim($baseurl, '/');
$username = strtolower($USER->username);
$timestamp = time();
$payload = $username . ':' . $levelnumber . ':' . $timestamp;
$signature = hash_hmac('sha256', $payload, $secret);

$ssourl = $baseurl . '/sso/from-moodle?'
    . 'username=' . rawurlencode($username)
    . '&level=' . $levelnumber
    . '&timestamp=' . $timestamp
    . '&signature=' . $signature;

// Bouton qui ouvre AlgoMaze dans un nouvel onglet (l'étudiant garde la page
// Moodle ouverte ; à son retour il rafraîchit pour voir le statut mis à jour).
echo html_writer::start_div('algomaze-launch', ['style' => 'text-align: center; margin: 24px 0;']);
echo html_writer::link(
    $ssourl,
    get_string('startactivity', 'algomazevalidation'),
    [
        'class' => 'btn btn-primary btn-lg',
        'target' => '_blank',
        'rel' => 'noopener'
    ]
);
echo html_writer::tag('p',
    get_string('opensinnewtab', 'algomazevalidation'),
    ['class' => 'text-muted', 'style' => 'margin-top: 12px; font-size: 0.9em;']
);
echo html_writer::end_div();

echo $OUTPUT->footer();
