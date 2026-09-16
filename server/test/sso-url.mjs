// Génère une URL SSO signée comme le ferait le plugin Moodle (utile pour tester à la main).
// Usage : node test/sso-url.mjs <username> [level] [moodleid] [ageSeconds]
//   ageSeconds : décale le timestamp dans le passé (simule un lien ancien).

import 'dotenv/config';
import crypto from 'node:crypto';

const [username = 'alice', levelArg = '2', moodleidArg = '42', ageArg = '0'] = process.argv.slice(2);
const secret = process.env.MOODLE_SHARED_SECRET;
if (!secret) { console.error('MOODLE_SHARED_SECRET manquant dans .env'); process.exit(1); }

const base = process.env.APP_ORIGIN || 'http://localhost:3000';
const uname = String(username).toLowerCase();
const level = parseInt(levelArg, 10) || 0;
const moodleid = parseInt(moodleidArg, 10);
const timestamp = Math.floor(Date.now() / 1000) - (parseInt(ageArg, 10) || 0);
const payload = isNaN(moodleid)
    ? `${uname}:${level}:${timestamp}`
    : `${uname}:${level}:${timestamp}:${moodleid}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

let url = `${base}/sso/from-moodle?username=${encodeURIComponent(uname)}&level=${level}&timestamp=${timestamp}`;
if (!isNaN(moodleid)) url += `&moodleid=${moodleid}`;
url += `&signature=${signature}`;
console.log(url);
