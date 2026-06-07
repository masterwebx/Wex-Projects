import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

const page1 = loadJson('testdata/amt-rpt-page1.json');

const page2 = [
  {
    number: 10,
    question: 'The liquid portion of an anti-coagulated blood specimen is called...',
    options: ['serum', 'Plasma', 'Oxygenated blood', 'Cellular components'],
    correctIndex: 1,
    category: 'Vial Info',
  },
  {
    number: 11,
    question: 'Which of the following would be first in the sequence of performing a finger stick procedure?',
    options: [
      'Sanitize hands and put on gloves.',
      'Clean and air-dry the puncture site.',
      'Select the puncture/incision site.',
      'Warm the puncture/incision site.',
    ],
    correctIndex: 0,
    category: 'Procedure',
  },
  {
    number: 12,
    question: 'Complete clotting of a blood specimen can take up to...',
    options: [
      '10 minutes at room temperature.',
      '30 minutes at room temperature.',
      '30 minutes at refrigeration temperature.',
      '2 hours at room temperature.',
    ],
    correctIndex: 1,
    category: 'Vial Info',
  },
  {
    number: 13,
    question: 'Older patients are more prone to hematoma formation because...',
    options: [
      'they have smaller veins.',
      'Tourniquets must be tied tighter.',
      'Their veins have decreased elasticity.',
      'They have difficulty making a fist.',
    ],
    correctIndex: 2,
    category: 'Blood issue',
  },
  {
    number: 14,
    question: 'When blood is inoculated into blood culture bottles using a butterfly apparatus...',
    options: [
      'anaerobic bottle is inoculated first.',
      'Safety device is activated first.',
      'Aerobic bottle is inoculated first.',
      'Volume of blood inoculated is increased.',
    ],
    correctIndex: 2,
    category: 'Procedure',
  },
  {
    number: 15,
    question: 'The primary reason for using a syringe transfer device is to...',
    options: [
      'safely transfer blood from a syringe into ETS tubes.',
      'Ensure that the proper amount of blood can be supplied to the lab.',
      'Provide an easy method to separate the packed cells from the plasma.',
      'Reduce the amount of time required to get the blood from a syringe to an evacuated tube.',
    ],
    correctIndex: 0,
    category: 'Procedure',
  },
  {
    number: 16,
    question: 'Which of the following represents the proper sequential draw from first to last?',
    options: [
      'Serum tube, heparin tube, EDTA tube',
      'Blue-top tube, EDTA tube, sterile tube',
      'Serum tube, sterile tube, blue top tube',
      'EDTA tube, serum tube, sterile tube',
    ],
    correctIndex: 0,
    category: 'Vial Info',
  },
  {
    number: 17,
    question: 'Which of the following may cause hematoma formation?',
    options: [
      'Removing the tourniquet before the needle',
      'Bandaging the patients arm immediately after arm has stopped bleeding',
      'Firmly anchoring vein in needle insertion',
      'Having the patient bend elbow to apply pressure',
    ],
    correctIndex: 3,
    category: 'Blood issue',
  },
  {
    number: 18,
    question: 'Which substance has a higher concentration in capillary blood than in venous blood?',
    options: ['Potassium', 'Calcium', 'Total Protein', 'Glucose'],
    correctIndex: 3,
    category: 'Vial Info',
  },
  {
    number: 19,
    question:
      'The heel is the recommended site for collection of capillary puncture specimens on infants and the phlebotomist is going to stick in the posterior curvature of the heel. Is this correct?',
    options: [
      'No, the medial plantar surface of the heel is the best site to prevent possible bone damage.',
      'No, the central plantar surface of the heel is a better choice.',
      'No, the anterior curvature of the heel is the preferred site on infants.',
      'No, the great toe is the best choice.',
    ],
    correctIndex: 0,
    category: 'Procedure',
  },
];

const pages20_49 = JSON.parse(
  readFileSync(join(root, 'scripts/chunks/pages-20-49.json'), 'utf8')
);
const pages50_89 = JSON.parse(
  readFileSync(join(root, 'scripts/chunks/pages-50-89.json'), 'utf8')
);
const pages90_138 = JSON.parse(
  readFileSync(join(root, 'scripts/chunks/pages-90-138.json'), 'utf8')
);
const pages139_210 = JSON.parse(
  readFileSync(join(root, 'scripts/chunks/pages-139-210.json'), 'utf8')
);

const all = [
  ...page1,
  ...page2,
  ...pages20_49,
  ...pages50_89,
  ...pages90_138,
  ...pages139_210,
];

const numbers = all.map((q) => q.number);
const unique = new Set(numbers);
if (all.length !== 210) throw new Error(`Expected 210 questions, got ${all.length}`);
if (unique.size !== 210) throw new Error(`Duplicate question numbers: ${numbers.length - unique.size}`);

for (let i = 1; i <= 210; i++) {
  if (!unique.has(i)) throw new Error(`Missing question number ${i}`);
}

const outPath = join(root, 'app/src/data/amt-rpt-mock-exam.json');
writeFileSync(outPath, JSON.stringify(all, null, 2));
console.log(`Wrote ${all.length} questions to ${outPath}`);
