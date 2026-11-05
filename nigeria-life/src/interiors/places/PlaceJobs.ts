import type { Builder } from '../../world/kit/ArchKit';
import type { ArmPose } from '../../interactions/Poses';
import type { StaffSpec } from './PlaceInterior';

/**
 * Work done inside the places along the expressway: who takes people on there, and the tasks
 * one shift is made of, each at the counter, bed, desk or stage where it is done. The tasks are
 * acted out in turn and the shift is paid once, when the last is done. The rates, grades and
 * the record of work are the employer's in `jobs/employers.ts`.
 */

export interface WorkTask {
  /** Where the worker stands, and what they face, in the room's own space */
  at: [number, number];
  look: [number, number];
  arms: ArmPose;
  sit?: boolean;
  seconds: number;
  /** What was done, as it is finished */
  says: string;
}

export interface WorkSpec {
  employer: string;
  /** The one in charge, who takes people on and keeps the book */
  boss: StaffSpec;
  /** One shift, in words: "serve a customer at the counter" */
  shift: string;
  /** The word for one shift's work, and for those done: "shift", "shifts" */
  piece?: string;
  /** How the boss offers the work */
  offer: string;
  /** What someone just taken on is told */
  ready: string;
  tasks: WorkTask[];
  /** Anything more the work needs in the room (a teller's counter, a mixing desk) */
  build?(b: Builder): void;
}

const W = (employer: string, boss: StaffSpec, shift: string, offer: string, ready: string, tasks: WorkTask[], build?: (b: Builder) => void): WorkSpec => ({ employer, boss, shift, offer, ready, tasks, build });
const task = (at: [number, number], look: [number, number], arms: ArmPose, seconds: number, says: string, sit = false): WorkTask => ({ at, look, arms, seconds, says, sit });
const HALF = Math.PI / 2;

export const PLACE_WORK: Record<string, WorkSpec[]> = {
  'marina-towers': [W('first-bank-marina',
    { name: 'Mr Eze', title: 'Branch manager', at: [10, -1], facing: -HALF, outfit: 0x0f172a, gender: 'male', tie: true, says: 'Good afternoon. We need tellers who can count.' },
    'serve a customer at the teller\'s window',
    'The bank takes tellers on by the customer served',
    'Your window is the first one. Next customer!',
    [
      task([5.5, -4.6], [5.5, -3.5], 'reach', 2.5, 'You take the deposit slip and the bundle of cash.'),
      task([7, -4.6], [7, -3.5], 'carry', 3, 'The notes run through the counting machine: ₦250,000, correct.'),
      task([8.4, -4.6], [8.4, -5.8], 'reach', 2.5, 'Posted to the account, and the receipt prints.'),
      task([5.5, -4.6], [5.5, -3.5], 'greet', 1.5, '"Thank you for banking with us." The customer smiles.'),
    ],
    (b) => {
      // The teller's counter of the bank in the tower, glass to the ceiling of it
      b.box(0x1e3a8a, 5.2, 1.05, 0.9, 7, 0, -3.5).box(0xf8fafc, 5.3, 0.06, 1, 7, 1.05, -3.5).box(0xbfe3ff, 5.2, 1, 0.04, 7, 1.11, -3.5);
      b.box(0x0f172a, 0.5, 0.3, 0.4, 7, 1.11, -3.8).box(0x334155, 4, 0.75, 0.6, 7, 0, -5.9).box(0x38bdf8, 0.5, 0.32, 0.03, 8.4, 0.95, -5.6, { glow: true });
    }),
  ],
  'afrika-shrine': [W('new-afrika-shrine',
    { name: 'Femi', title: 'Bandleader', at: [-7.5, -4], facing: HALF, outfit: 0xf59e0b, gender: 'male', says: 'You fit blow horn? The band needs hands.' },
    'play a set with the band',
    'The band pays its session players by the set',
    'Horns are on the stand. We start on the downbeat.',
    [
      task([2, -4.6], [2, -7], 'carry', 4, 'You blow the horn line with the band; the hall is moving.'),
      task([6, -0.8], [6, -2], 'reach', 3, 'At the desk you bring the horns up over the drums.'),
      task([2, -4.6], [2, -7], 'wave', 3, 'The last chorus, and the whole Shrine sings it back.'),
    ],
    (b) => b.box(0x111827, 2.2, 0.9, 1, 6, 0, -2).box(0x22c55e, 2, 0.04, 0.8, 6, 0.91, -2, { glow: true })),
  ],
  'balogun-market': [W('balogun-textiles',
    { name: 'Alhaji Danjuma', title: 'Cloth wholesaler', at: [13, -1], facing: -HALF, outfit: 0xf8fafc, gender: 'male', says: 'My bales no dey carry themselves. You want work?' },
    'bring in the bales and sell some lace',
    'I pay my boys by the delivery',
    'The bales are by the gate. Bring them to Alhaja\'s stall.',
    [
      task([2, 9], [2, 10.4], 'reach', 1.4, 'You heave a bale of lace off the pile.'),
      task([8.2, 0.6], [7, -1], 'carry', 1.4, 'It thumps down by the cloth stall.'),
      task([2, 9], [2, 10.4], 'reach', 1.4, 'Another bale onto your head.'),
      task([8.2, 0.6], [7, -1], 'carry', 1.4, 'Down by the stall. Alhaja counts them.'),
      task([6, 0.8], [6, 2.2], 'talk', 3, '"Original Swiss lace, ₦24,000 a yard." The buyer takes five.'),
    ],
    (b) => { for (let i = 0; i < 6; i++) b.box([0xfef3c7, 0xe0f2fe, 0xfce7f3][i % 3], 1, 0.5, 0.7, 1.4 + (i % 2) * 1.1, Math.floor(i / 2) * 0.5, 10.6); }),
  ],
  'amala-shitta': [W('amala-shitta-surulere',
    { name: 'Mr Shitta', title: 'Kitchen manager', at: [6.5, -5.5], facing: -HALF, outfit: 0x15803d, gender: 'male', chef: true, says: 'Na hot work. You fit turn amala?' },
    'turn the amala and serve a plate',
    'The kitchen pays by the shift',
    'Wash your hands. The omorogun is by the pot.',
    [
      task([-3, -6.2], [-3, -5.1], 'reach', 4, 'You turn the amala with the omorogun till it is smooth and black.'),
      task([1, -6.2], [1, -5.1], 'reach', 2.5, 'Gbegiri and ewedu ladled over it, and assorted on top.'),
      task([-4.5, -1.4], [-4.5, 0], 'carry', 1.5, 'The plate goes down at the table: "Enjoy!"'),
    ]),
  ],
  'i-fitness': [W('i-fitness-lekki',
    { name: 'Mrs Ibru', title: 'Gym manager', at: [-8.5, 6], facing: HALF, outfit: 0xea580c, gender: 'female', says: 'Our trainers work by the session. Are you fit enough?' },
    'train a client',
    'Trainers are paid by the session',
    'Your client is on the treadmill.',
    [
      task([-5.8, -4.6], [-5.8, -6], 'talk', 3, 'You talk your client through five kilometres.'),
      task([5.2, 1.2], [4, 0], 'reach', 3, 'You spot them on the bench press: "Push! One more!"'),
      task([0, 4], [0, 2.5], 'wave', 3, 'You lead the class: "Up! Down! Again!"'),
    ]),
  ],
  'ikeja-city-mall': [W('shoprite-ikeja',
    { name: 'Mr Okafor', title: 'Store manager', at: [-11.5, -2], facing: HALF, outfit: 0xdc2626, gender: 'male', tie: true, says: 'We need cashiers and shelf staff. Smart ones.' },
    'work a till and fill a shelf',
    'The supermarket pays by the shift',
    'Till three is yours. Smile at the customers.',
    [
      task([-8, 0.1], [-8, -1], 'reach', 3, 'Beep, beep, beep: a whole trolley through the till.'),
      task([-8, 0.1], [-8, -1], 'carry', 2, 'Bagged, and the customer pays: ₦38,400.'),
      task([-6.6, -5.8], [-6.6, -7], 'reach', 3, 'Cartons of noodles stacked on the shelf, labels to the front.'),
    ]),
  ],
  'mmia-terminal': [
    W('dana-checkin-desk',
      { name: 'Mrs Coker', title: 'Duty manager', at: [-12, -5], facing: HALF, outfit: 0x0b7a43, gender: 'female', says: 'Check-in agents work by the flight. Can you smile at 5 am?' },
      'check in a flight\'s passengers',
      'Agents are paid by the flight checked in',
      'Desk two. The Abuja flight is open.',
      [
        task([-5, -8], [-5, -7], 'reach', 2.5, 'Passport and ticket checked against the list.'),
        task([-5, -8], [-5, -7], 'carry', 2.5, 'The bag is weighed, tagged and sent down the belt.'),
        task([-5, -8], [-5, -7], 'reach', 2, '"Gate 4, boarding at three." The boarding pass prints.'),
      ]),
    W('faan-aviation-sec',
      { name: 'Commander Yusuf', title: 'AVSEC commander', at: [11, -1], facing: -HALF, outfit: 0x0f172a, gender: 'male', cap: true, says: 'Security is a serious job. Are you serious?' },
      'screen passengers at the checkpoint',
      'Screeners are paid by the shift',
      'Take the tray side. Nothing gets past us.',
      [
        task([5.2, 1.2], [5.2, 0], 'reach', 2.5, 'Belt, phone and keys checked in the tray.'),
        task([8.6, -1.2], [7, -1.2], 'greet', 2.5, 'The arch beeps; you wand the passenger. Only a coin.'),
        task([5.2, 1.2], [5.2, 0], 'reach', 2, 'The tray goes back and you wave them through.'),
      ]),
  ],
  'dangote-refinery': [W('dangote-refinery-ops',
    { name: 'Engr. Ade', title: 'Shift supervisor', at: [8, -6], facing: -HALF, outfit: 0xf8fafc, gender: 'male', says: 'Operators work by the shift. Hard hat, always.' },
    'run a shift in the control room',
    'Operators are paid by the shift',
    'Desk two is yours. Watch the crude unit.',
    [
      task([-3.5, -4.75], [-3.5, -6], 'reach', 4, 'You watch the crude unit\'s temperatures climb, and hold them.', true),
      task([3.5, -4.75], [3.5, -6], 'reach', 3, 'The hydrotreater pressure is balanced back into the green.', true),
      task([0, 1.6], [0, 0], 'reach', 3, 'Out on the floor, you check the valve by hand. Tight.'),
    ]),
  ],
  lasuth: [W('lasuth-nursing',
    { name: 'Matron Okoro', title: 'Matron', at: [2.5, -6.5], facing: 0, outfit: 0x1e40af, gender: 'female', says: 'The ward needs nurses. Are you trained?' },
    'do a ward round',
    'Nurses are paid by the shift',
    'Bed one first. Gloves on.',
    [
      task([-4.9, 4], [-6, 4], 'reach', 3, 'Temperature 37.2, blood pressure 120 over 80.'),
      task([-1.9, 4], [-3, 4], 'reach', 3, 'The drip changed, the injection given. The patient thanks you.'),
      task([-3.5, -7], [-3.5, -6], 'reach', 3, 'All of it written on the chart at the nurses\' station.'),
    ]),
  ],
  'ladipo-auto': [W('ladipo-mechanic',
    { name: 'Baba Ladipo', title: 'Workshop owner', at: [8, -6], facing: -HALF, outfit: 0x78350f, gender: 'male', says: 'I take apprentices. Your hand must be strong.' },
    'fix a customer\'s car',
    'I pay by the car fixed',
    'The blue Camry is yours. It is overheating.',
    [
      task([2, -0.4], [2, -1.5], 'reach', 3, 'Bonnet up. The fault: a worn fan belt.'),
      task([-7, -6.2], [-7, -7.5], 'reach', 2, 'A new fan belt from Alhaji\'s shelf.'),
      task([2, -0.4], [2, -1.5], 'reach', 4, 'Fitted, tightened, and the engine purrs.'),
    ]),
  ],
  'computer-village': [W('cv-phone-repair',
    { name: 'Oga Chinedu', title: 'Shop owner', at: [-12, 1], facing: HALF, outfit: 0x1d4ed8, gender: 'male', says: 'My bench needs another engineer. You get steady hand?' },
    'repair a phone at the bench',
    'I pay by the phone repaired',
    'The cracked one on the mat is yours.',
    [
      task([-4, 1.8], [-4, 3], 'reach', 3, 'Heat pad, pick, and the cracked screen lifts off.'),
      task([-4, 1.8], [-4, 3], 'reach', 4, 'The new screen fitted and sealed.'),
      task([-4, 1.8], [-4, 3], 'greet', 2, 'It turns on. The customer: "Like new!"'),
    ],
    (b) => b.box(0x78350f, 2.4, 0.9, 1, -4, 0, 3).box(0x22d3ee, 0.6, 0.02, 0.4, -4, 0.92, 3, { glow: true })),
  ],
  'radio-house': [W('naijafm-radio',
    { name: 'Mr Bankole', title: 'Station manager', at: [7, 5], facing: -HALF, outfit: 0x111827, gender: 'male', tie: true, says: 'You get voice for radio? Let me hear you.' },
    'present a segment on air',
    'The station pays by the segment',
    'You are on after the news. Mic two.',
    [
      task([-1, -4], [-1, -5], 'talk', 4, '"Third Mainland is locked; use Carter Bridge." The traffic is read.', true),
      task([-1, -4], [-1, -5], 'reach', 3, 'The next song is up, and a caller from Ikorodu is on the line.', true),
      task([-5, 6.3], [-5, 5], 'reach', 2, 'The adverts logged with the producer.'),
    ]),
  ],
  'eko-grand-hotel': [W('eko-grand-staff',
    { name: 'Mr Lawal', title: 'Hotel manager', at: [-9.5, -3], facing: HALF, outfit: 0xb45309, gender: 'male', tie: true, says: 'Five-star service. Can you give it?' },
    'look after guests for a shift',
    'The hotel pays by the shift',
    'Reception first, then room 204.',
    [
      task([-3.5, -7], [-3.5, -6], 'reach', 3, 'A guest checked in: passport, key card, "Welcome to Eko Grand."'),
      task([6, -4.6], [6, -6], 'reach', 4, 'Room made up: fresh sheets, the towels folded into swans.'),
      task([-6, 4.4], [-6, 3], 'carry', 2, 'Seafood okra served at table two.'),
    ]),
  ],
  'chop-express': [W('chop-express-crew',
    { name: 'Mr Ibe', title: 'Branch manager', at: [6.5, -5.5], facing: -HALF, outfit: 0xdc2626, gender: 'male', says: 'Crew wanted. Fast hands, clean hands.' },
    'serve orders on the counter',
    'Crew are paid by the shift',
    'Cap on. You are on the jollof.',
    [
      task([-2.5, -6.2], [-2.5, -5], 'reach', 3, 'Jollof scooped, and a chicken thigh out of the fryer.'),
      task([2, -6.2], [2, -5], 'carry', 2, 'Packed for takeaway: "Order 47!"'),
      task([-4, 2.4], [-4, 1], 'reach', 2, 'Table three wiped clean.'),
    ]),
  ],
  'ikeja-gra': [W('gra-interiors',
    { name: 'Mrs Bello', title: 'Interior designer', at: [6.5, -5.5], facing: -HALF, outfit: 0x7c3aed, gender: 'female', says: 'I design homes in the GRA. I need a decorator with taste.' },
    'design a room for a client',
    'Decorators are paid by the room',
    'The client wants a living room by Friday.',
    [
      task([0, -6.8], [0, -7.9], 'reach', 3, 'Fabric and paint swatches pinned on the mood board.'),
      task([3, -3.25], [3, -4], 'reach', 4, 'The plan drawn: POP ceiling, gold curtains, a cream rug.', true),
      task([4.5, 1.5], [6, 1.5], 'talk', 3, 'You show the client the plan: "I love it! Start on Monday."'),
    ]),
  ],
};

/** Which place each of these employers works out of */
export const WORKPLACE: Record<string, string> = Object.fromEntries(Object.entries(PLACE_WORK).flatMap(([key, works]) => works.map((w) => [w.employer, key])));
