<?php

defined('MOODLE_INTERNAL') || die();

use core\http\client;


function algomazevalidation_supports($feature) {
    switch($feature) {
        case FEATURE_COMPLETION_HAS_RULES: return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS: return true;
    }

    return null;
}


/**
 * Crée une nouvelle instance de l'activité algomaze_validation.
 *
 * @param stdClass $algomaze_validation Données du formulaire de l'activité.
 * @param mod_algomaze_validation_mod_form $mform Le formulaire de création/modification de l'activité.
 * @return int ID de l'instance nouvellement créée.
 */
function algomazevalidation_add_instance($algomazevalidation, $mform = null) {
    global $DB;

    $algomazevalidation->timecreated = time();
    $algomazevalidation->timemodified = $algomazevalidation->timecreated;

    // Insère l'enregistrement dans la base de données et retourne l'ID de l'instance.
    return $DB->insert_record('algomazevalidation', $algomazevalidation);
}

/**
 * Met à jour une instance existante de l'activité algomaze_validation.
 *
 * @param stdClass $algomaze_validation Données mises à jour de l'activité.
 * @param mod_algomaze_validation_mod_form $mform Le formulaire de création/modification de l'activité.
 * @return bool True en cas de succès, False en cas d'échec.
 */
function algomazevalidation_update_instance($algomazevalidation, $mform = null) {
    global $DB;

    $algomazevalidation->timemodified = time();
    $algomazevalidation->id = $algomazevalidation->instance;

    // Met à jour l'enregistrement dans la base de données.
    return $DB->update_record('algomazevalidation', $algomazevalidation);
}

/**
 * Supprime une instance de l'activité algomaze_validation.
 *
 * @param int $id ID de l'instance de l'activité à supprimer.
 * @return bool True en cas de succès, False en cas d'échec.
 */
function algomazevalidation_delete_instance($id) {
    global $DB;

    if (!$algomazevalidation = $DB->get_record('algomazevalidation', array('id' => $id))) {
        return false;
    }

    // Supprime l'enregistrement de la base de données.
    $DB->delete_records('algomazevalidation', array('id' => $algomazevalidation->id));

    return true;
}

/**
 * Détermine si l'activité algomaze_validation est terminée pour un utilisateur donné.
 *
 * Appelé par Moodle pour la complétion automatique. DOIT retourner un booléen
 * (ou $type si la règle n'a pas son mot à dire). Ne pas modifier l'état de
 * complétion ici — c'est le rôle de Moodle de le faire à partir de la valeur
 * retournée.
 *
 * @param stdClass $course Le cours actuel.
 * @param stdClass $cm L'instance du module de cours.
 * @param int $userid ID de l'utilisateur.
 * @param bool $type Valeur par défaut à retourner si la règle ne décide pas.
 * @return bool True si l'utilisateur a validé le niveau côté AlgoMaze.
 */
function algomazevalidation_get_completion_state($course, $cm, $userid, $type) {
    global $DB;

    $instance = $DB->get_record('algomazevalidation', array('id' => $cm->instance), '*', MUST_EXIST);
    $levelnumber = (int)$instance->levelnumber;

    return (bool)external_site_check_completion($userid, $levelnumber);
}

/**
 * Fonction personnalisée pour vérifier l'achèvement de l'activité via un site externe.
 *
 * @param int $userid ID de l'utilisateur.
 * @param int $levelnumber Numéro de niveau à vérifier.
 * @return bool True si l'activité est achevée, False sinon.
 */
function external_site_check_completion($userid, $levelnumber) {
    global $DB;

    $user = $DB->get_record('user', array('id' => $userid), 'username', MUST_EXIST);
    $username = strtolower($user->username);
    $levelnumber = (int)$levelnumber;

    // Utilise la même `baseurl` que le SSO (configurée dans les paramètres du plugin).
    $baseurl = trim((string)get_config('mod_algomazevalidation', 'baseurl'));
    if (empty($baseurl)) {
        error_log('mod_algomazevalidation: baseurl non configurée — impossible de vérifier la complétion.');
        return false;
    }
    $apiurl = rtrim($baseurl, '/') . '/check_completion';

    $data = array(
        'username' => $username,
        'levelnumber' => $levelnumber,
    );

    $ch = curl_init($apiurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Évite que la page Moodle reste bloquée si AlgoMaze ne répond pas.

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status === 200) {
        $response_data = json_decode($response);
        if (isset($response_data->completed)) {
            return (bool)$response_data->completed;
        } else {
            error_log('mod_algomazevalidation: réponse API inattendue : ' . $response);
        }
    } else {
        error_log('mod_algomazevalidation: appel API échoué (status ' . $status . ') vers ' . $apiurl);
        error_log('Response body: ' . $response);
    }

    return false;
}

function algomazevalidation_completion_criteria($course, $cm, $userid) {
    global $DB;

    
    // Récupérer l'instance de l'activité
    $instance = $DB->get_record('algomazevalidation', array('id' => $cm->instance), '*', MUST_EXIST);
    $levelnumber = $instance->levelnumber;
    return external_site_check_completion($userid, $levelnumber); // Mark as completed
    

    return false; // Not completed
}

function mod_algomazevalidation_get_completion_active_rule_descriptions($cm) {
    if (empty($cm->customdata['customcompletionrules']) || $cm->completion != COMPLETION_TRACKING_AUTOMATIC) {
        return [];
    }

    $descriptions = [];
    foreach ($cm->customdata['customcompletionrules'] as $key => $val) {
        switch ($key) {
            case 'automaticcompletionvalidation':
                if (!empty($val)) {
                    $descriptions[] = "Validation automatisée";
                }
                break;
            default:
                break;
        }
    }
    return $descriptions;
}

function algomazevalidation_get_coursemodule_info($coursemodule) {
    global $DB;

    $dbparams = ['id' => $coursemodule->instance];
    $fields = '*';
    if (!$forum = $DB->get_record('algomazevalidation', $dbparams, $fields)) {
        return false;
    }

    $result = new cached_cm_info();
    $result->name = $forum->name;

    if ($coursemodule->showdescription) {
        // Convert intro to html. Do not filter cached version, filters run at display time.
        $result->content = format_module_intro('algomazevalidation', $forum, $coursemodule->id, false);
    }

    // Populate the custom completion rules as key => value pairs, but only if the completion mode is 'automatic'.
    if ($coursemodule->completion == COMPLETION_TRACKING_AUTOMATIC) {
        $result->customdata['customcompletionrules']['automaticcompletionvalidation'] = true;
    }

    return $result;
}