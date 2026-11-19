import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';

/**
 * A course taken on the phone: levels 0 to 5. Each level is a fee and a short test.
 * The certificate goes in the bag, and the CV reads it from there.
 */

const KEY = 'nl-qualifications';

export interface Course {
  id: string;
  name: string;
  /** What a job asks for, in the words shown on the jobs list */
  paper: string;
  /** Fee for the next level, in naira. Index 0 is the fee to reach level 1. */
  fees: number[];
}

export const COURSES: Course[] = [
  { id: 'lawyer', name: 'Lawyer', paper: 'Lawyer', fees: [40000, 80000, 150000, 280000, 500000] },
  { id: 'doctor', name: 'Doctor', paper: 'Doctor', fees: [50000, 100000, 180000, 320000, 600000] },
  { id: 'software', name: 'Software developer', paper: 'Software developer', fees: [35000, 70000, 120000, 220000, 400000] },
  { id: 'banker', name: 'Banker', paper: 'Banker', fees: [30000, 60000, 110000, 200000, 360000] },
  { id: 'chef', name: 'Chef', paper: 'Chef', fees: [20000, 40000, 75000, 140000, 250000] },
  { id: 'musician', name: 'Musician', paper: 'Musician', fees: [15000, 30000, 60000, 110000, 200000] },
  { id: 'artist', name: 'Artist', paper: 'Artist', fees: [15000, 30000, 55000, 100000, 180000] },
  { id: 'fashion', name: 'Fashion designer', paper: 'Fashion designer', fees: [25000, 50000, 90000, 160000, 280000] },
  { id: 'pilot', name: 'Pilot', paper: 'Pilot', fees: [80000, 160000, 300000, 520000, 900000] },
  { id: 'estate', name: 'Real estate pro', paper: 'Real estate', fees: [30000, 60000, 110000, 200000, 350000] },
  { id: 'journalism', name: 'Journalism', paper: 'Journalism', fees: [20000, 40000, 80000, 140000, 240000] },
  { id: 'broadcast', name: 'Broadcast', paper: 'Broadcast', fees: [25000, 50000, 90000, 160000, 280000] },
  { id: 'entrepreneur', name: 'Entrepreneur', paper: 'Entrepreneur', fees: [20000, 45000, 90000, 160000, 300000] },
  { id: 'engineer', name: 'Civil engineer', paper: 'Civil engineer', fees: [40000, 80000, 150000, 260000, 450000] },
  { id: 'money', name: 'Money smart', paper: 'Money smart', fees: [10000, 25000, 50000, 90000, 150000] },
];

type Book = Record<string, number>;

export class Qualifications {
  private static inst: Qualifications | null = null;
  private levels: Book = {};

  public static get(): Qualifications {
    if (!Qualifications.inst) Qualifications.inst = new Qualifications();
    return Qualifications.inst;
  }

  private constructor() {
    try {
      const raw = localStorage.getItem(profileKey(KEY));
      if (raw) this.levels = JSON.parse(raw) as Book;
    } catch {
      this.levels = {};
    }
  }

  public course(id: string): Course | undefined {
    return COURSES.find((c) => c.id === id);
  }

  /** 0 until the first certificate, then 1 to 5 */
  public level(id: string): number {
    return Math.max(0, Math.min(5, this.levels[id] ?? 0));
  }

  /** Why a job that asks for this paper will not take the player, or null */
  public missing(courseId: string, need: number, paper: string): string | null {
    const have = this.level(courseId);
    if (have >= need) return null;
    return `Needs: ${paper} level ${need} certificate.`;
  }

  /**
   * Pay the fee for the next level and sit the test. The test is a short check the player
   * passes by confirming they sat it: the fee is the gate, and the certificate is the record.
   */
  public sit(id: string): { ok: boolean; message: string } {
    const course = this.course(id);
    if (!course) return { ok: false, message: 'That course is not on the list.' };
    const have = this.level(id);
    if (have >= 5) return { ok: false, message: 'You already hold the top certificate.' };
    const fee = course.fees[have];
    const next = have + 1;
    const paid = BackendService.getInstance().processTransaction({
      type: 'SHOP_PURCHASE',
      amount: fee,
      description: `${course.name} level ${next}`,
      source: 'bank',
    });
    if (!paid.success) return { ok: false, message: `Level ${next} is ₦${fee.toLocaleString()} and you do not have it.` };
    this.levels[id] = next;
    this.save();
    const name = `${course.paper} level ${next} certificate`;
    BackendService.getInstance().addItem({
      id: `cert_${id}_${next}`,
      name,
      icon: '🎓',
      price: fee,
      category: 'document',
      usable: false,
      description: `A ${course.name} certificate, level ${next} of 5. It sits on your CV.`,
    });
    return { ok: true, message: `You passed. ${name} is in your bag and on your CV.` };
  }

  private save(): void {
    try {
      localStorage.setItem(profileKey(KEY), JSON.stringify(this.levels));
    } catch {
      // The bag still holds the certificate
    }
  }
}
