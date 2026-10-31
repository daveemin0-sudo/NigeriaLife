import * as THREE from 'three';
import { profileKey } from '../backend/Profile';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';

/**
 * Classes at UNILAG: a course is chosen at the lecture podium, and each lesson is sat through at
 * a desk in the hall: the lecturer's points go up on the board, the student takes notes, and at
 * the end there is a question. Answered right, the lesson counts and the skill grows; five
 * lessons pass the course and a certificate goes in the bag.
 */

interface Lesson {
  title: string;
  points: [string, string, string];
  question: string;
  answers: [string, string, string];
  /** Which answer is right */
  right: 0 | 1 | 2;
}

interface Course {
  id: string;
  name: string;
  lecturer: string;
  skill: string;
  icon: string;
  lessons: Lesson[];
}

export const COURSES: Course[] = [
  {
    id: 'csc101', name: 'CSC 101 · Introduction to Programming', lecturer: 'Dr. Ifeanyi Okoro', skill: 'coding', icon: '💻', lessons: [
      { title: 'What a program is', points: ['A program is a list of steps', 'The computer does them in order', 'A bug is a wrong step'], question: 'What is a bug?', answers: ['A wrong step in a program', 'A fast computer', 'A kind of keyboard'], right: 0 },
      { title: 'Variables', points: ['A variable is a named box', 'It holds a value: age = 21', 'The value can change'], question: 'In "age = 21", what is age?', answers: ['A loop', 'A variable', 'A file'], right: 1 },
      { title: 'If and else', points: ['Programs make choices', 'if (rain) take umbrella', 'else go without one'], question: 'What does "if" let a program do?', answers: ['Print faster', 'Make a choice', 'Turn itself off'], right: 1 },
      { title: 'Loops', points: ['A loop repeats steps', 'for each customer: give change', 'It stops when told to'], question: 'What does a loop do?', answers: ['Repeats steps', 'Deletes files', 'Charges the phone'], right: 0 },
      { title: 'Functions', points: ['A function is a named recipe', 'Write it once, use it often', 'It can take inputs and give back a result'], question: 'Why write a function?', answers: ['To make the screen bigger', 'To pay less tax', 'To use the same steps many times'], right: 2 },
    ],
  },
  {
    id: 'eco101', name: 'ECO 101 · Principles of Economics', lecturer: 'Prof. Ngozi Adeyemi', skill: 'business', icon: '📈', lessons: [
      { title: 'Supply and demand', points: ['Many buyers, few goods: price goes up', 'Many goods, few buyers: price falls', 'Price is where they meet'], question: 'Tomatoes are scarce in the rainy season. The price…', answers: ['Goes up', 'Goes down', 'Stays the same'], right: 0 },
      { title: 'Inflation', points: ['Prices rising over time', 'Your naira buys less', 'Saving in naira loses value'], question: 'Inflation means your money buys…', answers: ['More', 'Less', 'The same'], right: 1 },
      { title: 'Opportunity cost', points: ['Choosing one thing means giving up another', 'The cost is the best thing you gave up', 'Time has an opportunity cost too'], question: 'You skip a ₦20,000 shift to watch a match. The opportunity cost is…', answers: ['₦0', 'The ₦20,000 shift', 'The match ticket'], right: 1 },
      { title: 'Interest', points: ['Borrowing costs interest', 'Saving earns interest', 'Compound interest grows on itself'], question: 'Compound interest is interest that…', answers: ['Is never paid', 'Earns interest itself', 'Only banks pay'], right: 1 },
      { title: 'Exchange rates', points: ['The naira is traded for dollars', 'A weaker naira makes imports dearer', 'Exports become cheaper abroad'], question: 'When the naira weakens, imported phones become…', answers: ['Dearer', 'Cheaper', 'Free'], right: 0 },
    ],
  },
  {
    id: 'law101', name: 'LAW 101 · Your Rights in Nigeria', lecturer: 'Barr. Aisha Bello', skill: 'law', icon: '⚖️', lessons: [
      { title: 'The Constitution', points: ['The highest law of the land', 'It sets out your rights', 'No law may go against it'], question: 'Which law is highest in Nigeria?', answers: ['A state law', 'The Constitution', 'A company rule'], right: 1 },
      { title: 'Arrest and bail', points: ['You must be told why you are arrested', 'You may stay silent', 'Bail is free by law'], question: 'Bail, by law, is…', answers: ['₦50,000', 'Free', 'Only for the rich'], right: 1 },
      { title: 'Tenancy', points: ['Get a written tenancy agreement', 'A landlord must give proper notice', 'Keep receipts of every payment'], question: 'What protects a tenant most?', answers: ['A written agreement and receipts', 'A friendly smile', 'Paying in cash only'], right: 0 },
      { title: 'Contracts', points: ['An offer, an acceptance, something given', 'Both sides must agree freely', 'Write it down'], question: 'A contract needs an offer and…', answers: ['An acceptance', 'A lawyer', 'A stamp'], right: 0 },
      { title: 'Voting', points: ['Every adult citizen can vote', 'Your PVC is your vote', 'Vote buying is a crime'], question: 'Selling your vote is…', answers: ['Allowed', 'A crime', 'Required'], right: 1 },
    ],
  },
  {
    id: 'mac101', name: 'MAC 101 · Mass Communication', lecturer: 'Dr. Tunde Bakare', skill: 'music', icon: '🎙️', lessons: [
      { title: 'The news', points: ['Who, what, when, where, why', 'The most important first', 'Check before you share'], question: 'Before sharing a story you should…', answers: ['Add more drama', 'Check it is true', 'Share it twice'], right: 1 },
      { title: 'Radio', points: ['Voice, music, silence', 'Speak to one listener', 'Short sentences'], question: 'On radio, speak as if to…', answers: ['A crowd of thousands', 'One listener', 'Nobody'], right: 1 },
      { title: 'Interviews', points: ['Prepare your questions', 'Listen more than you talk', 'Ask "why?"'], question: 'A good interviewer mostly…', answers: ['Listens', 'Shouts', 'Leaves early'], right: 0 },
      { title: 'Social media', points: ['Know your audience', 'Post often, post well', 'Answer your followers'], question: 'What grows an audience?', answers: ['Posting well and often', 'Never posting', 'Buying followers'], right: 0 },
      { title: 'Ethics', points: ['Tell the truth', 'Protect your sources', 'Correct your mistakes'], question: 'When a journalist gets it wrong, they should…', answers: ['Hide it', 'Correct it', 'Blame others'], right: 1 },
    ],
  },
  {
    id: 'bus101', name: 'BUS 101 · Starting a Business', lecturer: 'Mrs. Funke Alade', skill: 'hustle', icon: '🏪', lessons: [
      { title: 'Find a need', points: ['Solve a problem people have', 'Ask them first', 'Start small'], question: 'A business starts with…', answers: ['A big office', 'A need people have', 'A loan'], right: 1 },
      { title: 'Costs and price', points: ['Know every cost', 'Price above cost', 'Profit = price − cost'], question: 'Profit is…', answers: ['Price minus cost', 'Cost minus price', 'All the money in the till'], right: 0 },
      { title: 'Keep records', points: ['Write down every sale', 'And every expense', 'Separate your money from the business'], question: 'Why keep records?', answers: ['To know if you make money', 'To fill paper', 'For fun only'], right: 0 },
      { title: 'Customers', points: ['Treat them well', 'They come back and bring friends', 'Ask what they want'], question: 'A happy customer…', answers: ['Never returns', 'Brings friends', 'Costs more'], right: 1 },
      { title: 'Growing', points: ['Reinvest profit', 'Hire good people', 'Open a second branch'], question: 'To grow, you should…', answers: ['Spend all profit', 'Reinvest profit', 'Close on Mondays'], right: 1 },
    ],
  },
  {
    id: 'med101', name: 'MED 101 · First Aid', lecturer: 'Dr. Chioma Uche', skill: 'fitness', icon: '🩺', lessons: [
      { title: 'Stay safe first', points: ['Check the scene is safe', 'Then check the person', 'Call for help: 112'], question: 'What is the emergency number?', answers: ['112', '999', '000'], right: 0 },
      { title: 'Bleeding', points: ['Press hard on the wound', 'Use a clean cloth', 'Keep pressing'], question: 'To stop bleeding you…', answers: ['Press on the wound', 'Pour water on it', 'Leave it'], right: 0 },
      { title: 'Burns', points: ['Cool under running water', '20 minutes', 'No oil, no toothpaste'], question: 'For a burn, use…', answers: ['Palm oil', 'Cool running water', 'Toothpaste'], right: 1 },
      { title: 'Choking', points: ['Ask "are you choking?"', 'Five back blows', 'Five abdominal thrusts'], question: 'First for choking:', answers: ['Five back blows', 'A glass of water', 'Lie them down'], right: 0 },
      { title: 'CPR', points: ['Not breathing: start CPR', 'Push hard and fast, centre of chest', '30 pushes, 2 breaths'], question: 'CPR pushes go on the…', answers: ['Stomach', 'Centre of the chest', 'Back'], right: 1 },
    ],
  },
];

type Progress = Record<string, number>;

export const Classes = {
  progress(): Progress {
    try {
      return JSON.parse(localStorage.getItem(profileKey('nl_classes_v1')) || '{}') as Progress;
    } catch {
      return {};
    }
  },
  save(p: Progress): void {
    try {
      localStorage.setItem(profileKey('nl_classes_v1'), JSON.stringify(p));
    } catch {
      // Kept for this visit only
    }
  },

  /**
   * At the podium: which course; then the lesson, sat through at a desk of the hall (`room` is the
   * hall's group: the board is painted with the lesson while it is taught).
   */
  choose(host: PlaceHost, room: THREE.Group): void {
    const done = this.progress();
    host.ask({
      who: 'UNILAG · Faculty lectures',
      role: 'Choose a course · five lessons each',
      text: 'Take a seat in the hall: the lecturer teaches at the board, and there is a question at the end of each lesson.',
      choices: COURSES.map((c) => {
        const n = done[c.id] ?? 0;
        return { label: `${c.icon} ${c.name}`, note: n >= c.lessons.length ? 'Passed · certificate earned' : `Lesson ${n + 1} of ${c.lessons.length}`, pick: () => this.attend(host, room, c) };
      }),
    });
  },

  attend(host: PlaceHost, room: THREE.Group, course: Course): void {
    const done = this.progress();
    const n = Math.min(done[course.id] ?? 0, course.lessons.length - 1);
    const lesson = course.lessons[n];
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const o = room.position;
    // A chair in the front row, its desk before it, the board beyond
    const seat = new THREE.Vector3(o.x - 2.5, 0, o.z - 1.1);
    const aisle = new THREE.Vector3(o.x - 2.5, 0, o.z - 0.25);
    const board = paintBoard(room, course, lesson, n);
    const sitting = new Sequence(`class: ${course.name}`, [actor]).add(
      steps.walk(actor, aisle, { ifStuck: 'snap' }),
      steps.face(actor, Math.PI),
      steps.slide(actor, seat, 0.5),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.call('the lecture begins', () => { host.say(`${course.lecturer}: "Today, ${lesson.title.toLowerCase()}. Write this down."`, 'info'); }),
      steps.animate(actor, { legs: 'sit', arms: 'palms' }, 9, [
        { at: 0.35, run: () => { board.reveal(2); } },
        { at: 0.7, run: () => { board.reveal(3); } },
      ]),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
    );
    sitting.onEnd((reason) => {
      if (reason !== 'done') {
        board.clear();
        return;
      }
      // The question, still sitting; then up again
      const getUp = () => {
        board.clear();
        const up = new Sequence('up from the desk', [actor]).add(steps.setPose(actor, { legs: 'stand', arms: 'rest' }), steps.slide(actor, aisle, 0.5));
        host.director.run(up);
      };
      host.ask({
        who: course.lecturer,
        role: `${course.name} · lesson ${n + 1}`,
        text: lesson.question,
        choices: lesson.answers.map((answer, i) => ({
          label: answer,
          pick: () => {
            if (i === lesson.right) {
              const p = this.progress();
              p[course.id] = Math.min(course.lessons.length, (p[course.id] ?? 0) + 1);
              this.save(p);
              (host.backend as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp(course.skill, 1);
              host.backend.modifyNeed('energy', -8);
              if (p[course.id] >= course.lessons.length && (done[course.id] ?? 0) < course.lessons.length) {
                host.backend.addItem({ id: `cert_${course.id}`, name: `Certificate · ${course.name}`, icon: '🎓', category: 'document', description: `Passed at the University of Lagos, taught by ${course.lecturer}.`, price: 0, usable: false });
                host.say(`🎓 Correct! You have passed ${course.name}. The certificate is in your bag.`, 'success');
              } else host.say(`✅ Correct! Lesson ${n + 1} of ${course.lessons.length} done. ${course.skill} +1.`, 'success');
            } else host.say(`❌ Not quite: "${lesson.answers[lesson.right]}". Sit the lesson again to count it.`, 'warning');
            getUp();
          },
        })),
      });
    });
    host.director.run(sitting);
  },
};

/** The board in front of the hall, the lesson written up a point at a time */
function paintBoard(room: THREE.Group, course: Course, lesson: Lesson, index: number): { reveal(n: number): void; clear(): void } {
  let plane = room.getObjectByName('lesson board') as THREE.Mesh | undefined;
  const canvas = (plane?.userData.canvas as HTMLCanvasElement | undefined) ?? document.createElement('canvas');
  if (!plane) {
    canvas.width = 1024;
    canvas.height = 280;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    plane = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 3.1), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    plane.name = 'lesson board';
    plane.position.set(0, 2.8, -11.5);
    plane.userData.canvas = canvas;
    room.add(plane);
  }
  const mesh = plane;
  const draw = (shown: number) => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (shown < 0) {
      (mesh.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
      return;
    }
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'top';
    ctx.font = '700 40px "Segoe Print", "Comic Sans MS", cursive';
    ctx.fillText(`${course.name.split(' · ')[0]} · Lesson ${index + 1}: ${lesson.title}`, 30, 18);
    ctx.font = '600 34px "Segoe Print", "Comic Sans MS", cursive';
    lesson.points.slice(0, shown).forEach((point, i) => ctx.fillText(`• ${point}`, 50, 92 + i * 60));
    (mesh.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
  };
  draw(1);
  return { reveal: (n) => draw(n), clear: () => draw(-1) };
}
