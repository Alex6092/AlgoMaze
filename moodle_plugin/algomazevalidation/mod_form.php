<?php

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot.'/course/moodleform_mod.php');

class mod_algomazevalidation_mod_form extends moodleform_mod {
    function definition() {
        $mform = $this->_form;

        // Section générale (Nom de l'activité et description)
        $mform->addElement('header', 'general', get_string('general', 'form'));

        // Nom de l'activité
        $mform->addElement('text', 'name', get_string('name', 'algomazevalidation'), array('size' => '64'));
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');

        // Description de l'activité
        $this->standard_intro_elements();

        // Numéro de niveau (levelnumber)
        $mform->addElement('text', 'levelnumber', get_string('levelnumber', 'algomazevalidation'));
        $mform->setType('levelnumber', PARAM_INT);
        $mform->addRule('levelnumber', null, 'required', null, 'client');
        $mform->addRule('levelnumber', get_string('maximumchars', '', 10), 'maxlength', 10, 'client');

        // Option for completion tracking
        /*
        $mform->addElement('select', 'completion', get_string('completion', 'algomazevalidation'), array(
            0 => get_string('completion_auto', 'algomazevalidation')
        ));
        $mform->setType('completion', PARAM_INT);
        $mform->setDefault('completion', 0);
        */

        // Éléments standard (section visible, regroupement, etc.)
        $this->standard_coursemodule_elements();

        // Boutons de soumission du formulaire
        $this->add_action_buttons();
    }

    function data_preprocessing(&$defaultvalues) {
        parent::data_preprocessing($defaultvalues);
    }
}

