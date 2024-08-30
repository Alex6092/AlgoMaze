<?php

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

// Update completion state
$completion = new completion_info($course);
if ($completion->is_enabled($cm)) {
    $completion->update_state($cm, COMPLETION_COMPLETE);
}

// Afficher l'entête de la page
echo $OUTPUT->header();

// Afficher le nom de l'activité
//echo $OUTPUT->heading(format_string($algomazevalidation->name), 2);

// Afficher la description de l'activité, si elle existe
//if (!empty($algomazevalidation->intro)) {
//    echo $OUTPUT->box(format_module_intro('algomazevalidation', $algomazevalidation, $cm->id), 'generalbox mod_introbox', 'algomazevalidationintro');
//}

// Afficher les détails spécifiques à l'activité
//echo html_writer::start_div('algomazevalidation_content');

// Exemple de section spécifique à l'activité
//echo html_writer::tag('p', get_string('levelnumber', 'algomazevalidation') . ': ' . $algomazevalidation->levelnumber);

// Ajouter ici d'autres informations spécifiques ou intégrations avec le site externe

//echo html_writer::end_div();

// Ajouter des liens ou des boutons si nécessaire, par exemple pour démarrer l'activité sur le site externe
//echo $OUTPUT->single_button(new moodle_url('https://algomaze.tspro.fr/maze', 
//    array('level' => $algomazevalidation->levelnumber)), get_string('startactivity', 'algomazevalidation'));

// Afficher le pied de page de Moodle
echo $OUTPUT->footer();

