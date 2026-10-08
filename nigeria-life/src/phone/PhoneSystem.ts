import { BackendService } from '../backend/BackendService';
import type { PhoneContact, JobListing, DatingProfile } from './types';

export class PhoneSystem {
  private static instance: PhoneSystem;
  private backend: BackendService;

  public contacts: PhoneContact[] = [
    {
      id: 'zay_ne',
      handle: 'zay_ne',
      name: 'Zainab (@zay_ne)',
      avatar: '👑',
      status: 'Online • Lekki Phase 1',
      lastMessage: '🔥 E choke!',
      unread: false,
      messages: [
        { sender: 'me', text: 'GOOD', time: '8:51 PM' },
        { sender: 'me', text: 'Abi you waste the money', time: '8:51 PM' },
        { sender: 'them', text: 'NOOOOOOOOO', time: '8:53 PM' },
        { sender: 'system', transferAmount: 2000000000, time: '11:37 PM' },
        { sender: 'them', sticker: 'lion', stickerCaption: 'Odogwu!', time: '8:04 AM' },
        { sender: 'me', text: 'na less', time: '8:39 AM' },
        { sender: 'them', sticker: 'fire', stickerCaption: 'E choke!', time: '9:53 AM' },
      ],
    },
    {
      id: 'mama_put',
      handle: 'mama_put_eko',
      name: 'Mama Put (Bukateria)',
      avatar: '🍲',
      status: 'Online • Broad St.',
      lastMessage: 'Special Party Jollof is ready! Come chop!',
      unread: true,
      messages: [
        { sender: 'them', text: 'Good day! Today we have hot Asun and fresh Afang soup o.', time: '09:15 AM' },
        { sender: 'them', text: 'Special Party Jollof is ready! Come chop!', time: '10:02 AM' },
      ],
    },
    {
      id: 'segun_bet',
      handle: 'segun_odds',
      name: 'Segun (NaijaBet Pal)',
      avatar: '⚽',
      status: 'Online',
      lastMessage: 'Guy play Real Madrid straight win today!',
      unread: false,
      messages: [
        { sender: 'them', text: 'Guy, Chelsea ruined my accumulator yesterday.', time: 'Yesterday' },
        { sender: 'me', text: 'I told you to play Over 1.5 goals instead!', time: 'Yesterday' },
        { sender: 'them', text: 'Guy play Real Madrid straight win today!', time: '08:40 AM' },
      ],
    },
    {
      id: 'blessing_lekki',
      handle: 'blessing_vibes',
      name: 'Blessing (From Lekki)',
      avatar: '✨',
      status: 'Online',
      lastMessage: 'When are you taking me to Grand Palms Lounge?',
      unread: true,
      messages: [
        { sender: 'them', text: 'Hey Bayo! Loved your Agbada outfit on your profile.', time: 'Yesterday' },
        { sender: 'them', text: 'When are you taking me to Grand Palms Lounge?', time: '10:14 AM' },
      ],
    },
    {
      id: 'alhaji_landlord',
      handle: 'alhaji_estate',
      name: 'Alhaji (Landlord)',
      avatar: '🏠',
      status: 'Last seen 2h ago',
      lastMessage: 'Electricity service charge is due tomorrow.',
      unread: false,
      messages: [
        { sender: 'them', text: 'Peace be unto you. Generator maintenance was done.', time: 'Monday' },
        { sender: 'them', text: 'Electricity service charge is due tomorrow.', time: 'Yesterday' },
      ],
    },
  ];

  public jobs: JobListing[] = [
    {
      id: 'job_conductor',
      title: 'Danfo Bus Conductor Shift',
      company: 'Lagos Road Transport Union',
      pay: 4500,
      energyCost: 30,
      durationSeconds: 3,
      description: 'Call passengers from Broad Street to Oshodi, collect cash fare and maintain order.',
      icon: '🚌',
    },
    {
      id: 'job_pos',
      title: 'POS Cash Point Agent',
      company: 'KudiPoint / NaijaPay Hub',
      pay: 7500,
      energyCost: 20,
      durationSeconds: 3,
      description: 'Process card cashouts and bank transfers for Broad Street market traders.',
      icon: '💳',
    },
    {
      id: 'job_food_runner',
      title: 'Express Jollof Delivery',
      company: 'Mama Put Express',
      pay: 3800,
      energyCost: 25,
      durationSeconds: 3,
      description: 'Deliver hot steaming party jollof packs to corporate offices on Marina.',
      icon: '🍲',
    },
    {
      id: 'job_tech',
      title: 'Remote UI/UX Design Gig',
      company: 'Yaba Tech Startup',
      pay: 22000,
      energyCost: 35,
      durationSeconds: 4,
      description: 'Design mobile banking screens on Figma with standby inverter generator.',
      icon: '💻',
    },
  ];

  public datingProfiles: DatingProfile[] = [
    {
      id: 'date_01',
      name: 'Zainab',
      age: 23,
      location: 'Victoria Island, Lagos',
      bio: 'Fashion designer & content creator. Loves Suya and Afrobeats concerts.',
      avatar: '💃',
      liked: false,
    },
    {
      id: 'date_02',
      name: 'Chioma',
      age: 25,
      location: 'Lekki Phase 1',
      bio: 'Tech product manager. Looking for someone who doesn’t complain in third mainland traffic.',
      avatar: '🌟',
      liked: false,
    },
    {
      id: 'date_03',
      name: 'Fadekemi',
      age: 22,
      location: 'Yaba / Akoka',
      bio: 'Biochemistry grad & lifestyle vlogger. 100% Amala & Gbegiri enthusiast.',
      avatar: '🌸',
      liked: false,
    },
  ];

  private constructor() {
    this.backend = BackendService.getInstance();
  }

  public static getInstance(): PhoneSystem {
    if (!PhoneSystem.instance) {
      PhoneSystem.instance = new PhoneSystem();
    }
    return PhoneSystem.instance;
  }

  public workJob(jobId: string): { success: boolean; message: string; pay?: number } {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return { success: false, message: 'Job not found' };

    const data = this.backend.getData();
    if (data.stats.energy < job.energyCost) {
      return {
        success: false,
        message: `❌ You do not have enough energy! (Need ${job.energyCost}%). Eat at Mama Put to recharge.`,
      };
    }

    const multiplier = data.career?.bonusMultiplier || 1.0;
    const finalPay = Math.round(job.pay * multiplier);

    // Deduct energy & award cash
    this.backend.restoreEnergy(-job.energyCost);
    this.backend.addCash(finalPay);
    this.backend.addStreetCred(8);
    const careerResult = this.backend.addJobExperience(25);

    let msg = `🎉 Shift Completed! You earned ₦${finalPay.toLocaleString()} cash from ${job.company}!`;
    if (multiplier > 1.0) {
      msg += ` (${Math.round(multiplier * 100)}% Career Bonus)`;
    }
    if (careerResult.leveledUp) {
      msg += ` 🏆 PROMOTED! Your new title is "${careerResult.newTitle}"!`;
    }

    return {
      success: true,
      message: msg,
      pay: finalPay,
    };
  }

  public sendMessage(contactId: string, text: string): void {
    const contact = this.contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    contact.messages.push({ sender: 'me', text, time });
    contact.lastMessage = text;

    // Simulated quick reply after 1.5 seconds
    setTimeout(() => {
      let replyText = 'Received! Talk to you soon.';
      if (contactId === 'mama_put') replyText = 'Noted my pikin! I will keep a hot plate of Jollof for you!';
      else if (contactId === 'segun_bet') replyText = 'Bet confirmed! Let us watch the match results!';
      else if (contactId === 'blessing_lekki') replyText = 'Awww! Deal! Pick me up in an Uber later!';
      else if (contactId === 'alhaji_landlord') replyText = 'Thank you. Please remember to pay before weekend.';

      contact.messages.push({
        sender: 'them',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      contact.lastMessage = replyText;
      contact.unread = true;
    }, 1500);
  }

  public transferMoney(recipientTag: string, amount: number): { success: boolean; message: string } {
    const data = this.backend.getData();
    if (amount <= 0) return { success: false, message: 'Invalid transfer amount' };

    if (data.bank.balance < amount) {
      return { success: false, message: `❌ Insufficient bank balance for ₦${amount.toLocaleString()} transfer.` };
    }

    // Deduct from bank
    this.backend.spendCash(0); // Trigger save
    data.bank.balance -= amount;
    data.bank.transactions.unshift({
      id: `tx_${Date.now()}`,
      type: 'debit',
      amount,
      description: `EkoPay Transfer to @${recipientTag}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return {
      success: true,
      message: `✅ Transfer of ₦${amount.toLocaleString()} to @${recipientTag} was successful!`,
    };
  }

  public buyAirtime(network: string, amount: number): { success: boolean; message: string } {
    const data = this.backend.getData();
    if (data.walletCash < amount) {
      return { success: false, message: `❌ You need ₦${amount} cash to purchase airtime.` };
    }

    this.backend.spendCash(amount, `${network} Airtime Recharge`);
    return {
      success: true,
      message: `📲 Successfully recharged ₦${amount.toLocaleString()} ${network} Airtime & Data!`,
    };
  }
}
