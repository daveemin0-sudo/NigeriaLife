import { BackendService } from '../backend/BackendService';
import { SoundEngine } from '../audio/SoundEngine';
import { showGameToast } from '../ui/GameToast';
import type { StoryQuest, QuestCity } from './QuestTypes';

export class QuestManager {
  private static instance: QuestManager;
  private readonly STORAGE_KEY = 'nigeria_life_story_quests_v2';
  private quests: StoryQuest[] = [];
  private activeQuestId: string | null = null;
  private listeners: ((activeQuest: StoryQuest | null, allQuests: StoryQuest[]) => void)[] = [];

  private constructor() {
    this.initDefaultQuests();
    this.loadState();
  }

  public static getInstance(): QuestManager {
    if (!QuestManager.instance) {
      QuestManager.instance = new QuestManager();
    }
    return QuestManager.instance;
  }

  private initDefaultQuests(): void {
    this.quests = [
      // =========================================================================
      // LAGOS ARC: "From Aguda to Banana Island"
      // =========================================================================
      {
        id: 'quest_lagos_1',
        title: 'Mainland Hustle',
        arcName: 'From Aguda to Banana Island',
        city: 'lagos',
        chapterNumber: 1,
        description: 'Prove your grit on the Lagos mainland! Complete a job shift and grab hot fuel from Mama Put to kick off your rise.',
        giverName: 'Chidinma',
        giverRole: 'Yaba Connection & Friend',
        giverAvatar: '💁‍♀️',
        status: 'available',
        objectives: [
          { id: 'obj_l1_work', description: 'Complete any street job shift or hustle minigame', isCompleted: false },
          { id: 'obj_l1_eat', description: 'Chop hot food at Mama Put or order QuickChop', isCompleted: false },
        ],
        rewards: {
          cash: 15000,
          streetCred: 20,
          careerXp: 30,
          itemReward: {
            id: 'lagos_hustle_badge',
            name: 'Mainland Hustler Certified Seal',
            category: 'document',
            icon: '🏅',
            description: 'Proof that you survived and thrived on the trenches of Lagos Mainland.',
          },
        },
      },
      {
        id: 'quest_lagos_2',
        title: 'Wheels on Broad Street',
        arcName: 'From Aguda to Banana Island',
        city: 'lagos',
        chapterNumber: 2,
        description: 'No big man walks everywhere in Eko! Board a Danfo, ride an Okada, or cruise in a vehicle down the street.',
        giverName: 'Segun Odds',
        giverRole: 'Marina Danfo Chief',
        giverAvatar: '🚌',
        status: 'locked',
        objectives: [
          { id: 'obj_l2_drive', description: 'Take the wheel or honk the horn of any vehicle', isCompleted: false },
          { id: 'obj_l2_cred', description: 'Achieve 35+ Street Cred in the city', isCompleted: false },
        ],
        rewards: {
          cash: 35000,
          streetCred: 25,
          careerXp: 50,
          itemReward: {
            id: 'danfo_driver_key',
            name: 'Gold Commemorative Ignition Key',
            category: 'luxury',
            icon: '🔑',
            description: 'Custom brass key representing mastery of Lagos roads.',
          },
        },
      },
      {
        id: 'quest_lagos_3',
        title: 'Island Luxury Odogwu',
        arcName: 'From Aguda to Banana Island',
        city: 'lagos',
        chapterNumber: 3,
        description: 'Cross the bridge to the Island! Visit Quilox VIP or secure your own apartment residency on the waterfront.',
        giverName: 'Zainab (Odogwu)',
        giverRole: 'Banana Island Mogul',
        giverAvatar: '👑',
        status: 'locked',
        objectives: [
          { id: 'obj_l3_residence', description: 'Rest in your apartment or visit Quilox VIP lounge', isCompleted: false },
          { id: 'obj_l3_wealth', description: 'Accumulate ₦100,000+ total wealth', isCompleted: false },
        ],
        rewards: {
          cash: 75000,
          streetCred: 40,
          careerXp: 100,
          itemReward: {
            id: 'banana_island_pass',
            name: 'Banana Island VIP Resident Pass',
            category: 'luxury',
            icon: '💎',
            description: 'Black-card resident access to exclusive island marina and clubhouses.',
          },
        },
      },

      // =========================================================================
      // ABUJA ARC: "Three Arms Zone Contract"
      // =========================================================================
      {
        id: 'quest_abuja_1',
        title: 'Federal Capital Arrival',
        arcName: 'Three Arms Zone Contract',
        city: 'abuja',
        chapterNumber: 1,
        description: 'Land in the Federal Capital Territory! Take a Green Cab or stroll through the wide boulevards of Maitama & Central Business District.',
        giverName: 'Alhaji Garba',
        giverRole: 'Federal Procurement Director',
        giverAvatar: '🏛️',
        status: 'available',
        objectives: [
          { id: 'obj_a1_arrive', description: 'Travel to Abuja via Wazobia Air flight or road ride', isCompleted: false },
          { id: 'obj_a1_cab', description: 'Ride an Abuja Federal Green Cab or stroll Shehu Shagari Way', isCompleted: false },
        ],
        rewards: {
          cash: 30000,
          streetCred: 25,
          careerXp: 40,
        },
      },
      {
        id: 'quest_abuja_2',
        title: 'The Bureau Tender Document',
        arcName: 'Three Arms Zone Contract',
        city: 'abuja',
        chapterNumber: 2,
        description: 'Obtain an official Federal Tender Certificate from the Secretariat and submit project documentation.',
        giverName: 'Alhaji Garba',
        giverRole: 'Federal Procurement Director',
        giverAvatar: '📜',
        status: 'locked',
        objectives: [
          { id: 'obj_a2_tender', description: 'Acquire the Federal Contractor Certificate from Secretariat', isCompleted: false },
        ],
        rewards: {
          cash: 65000,
          streetCred: 35,
          careerXp: 70,
        },
      },
      {
        id: 'quest_abuja_3',
        title: 'Aso Rock Presidential Protocol',
        arcName: 'Three Arms Zone Contract',
        city: 'abuja',
        chapterNumber: 3,
        description: 'Visit the summit lookout by Aso Rock Monolith and seal the multi-million Naira infrastructure contract!',
        giverName: 'Special Adviser Protocol',
        giverRole: 'Presidency Liaison',
        giverAvatar: '🦅',
        status: 'locked',
        objectives: [
          { id: 'obj_a3_lookout', description: 'Inspect Aso Rock Lookout and acquire the commemorative plaque', isCompleted: false },
        ],
        rewards: {
          cash: 150000,
          streetCred: 50,
          careerXp: 150,
          itemReward: {
            id: 'presidential_seal',
            name: 'Executive Federal Seal Document',
            category: 'document',
            icon: '🦅',
            description: 'Presidential clearance seal for nationwide infrastructure projects.',
          },
        },
      },

      // =========================================================================
      // PORT HARCOURT ARC: "Trans-Amadi Logistics Run"
      // =========================================================================
      {
        id: 'quest_ph_1',
        title: 'Garden City Logistics Landing',
        arcName: 'Trans-Amadi Logistics Run',
        city: 'port_harcourt',
        chapterNumber: 1,
        description: 'Arrive at the oil & gas hub! Survey Old GRA and check in with depot coordinators.',
        giverName: 'Tamuno Briggs',
        giverRole: 'Trans-Amadi Operations Manager',
        giverAvatar: '🛢️',
        status: 'available',
        objectives: [
          { id: 'obj_p1_arrive', description: 'Travel to Port Harcourt city', isCompleted: false },
        ],
        rewards: {
          cash: 25000,
          streetCred: 20,
          careerXp: 35,
        },
      },
      {
        id: 'quest_ph_2',
        title: 'Generator Overhaul & Freight',
        arcName: 'Trans-Amadi Logistics Run',
        city: 'port_harcourt',
        chapterNumber: 2,
        description: 'Industrial generators are down across the freight zone. Overhaul the generator or complete a mechanical repair shift.',
        giverName: 'Tamuno Briggs',
        giverRole: 'Trans-Amadi Operations Manager',
        giverAvatar: '🔧',
        status: 'locked',
        objectives: [
          { id: 'obj_p2_repair', description: 'Solve Tiger generator power issue or complete mechanic shift', isCompleted: false },
        ],
        rewards: {
          cash: 60000,
          streetCred: 35,
          careerXp: 75,
        },
      },
      {
        id: 'quest_ph_3',
        title: 'Niger Delta Oilfield Mogul',
        arcName: 'Trans-Amadi Logistics Run',
        city: 'port_harcourt',
        chapterNumber: 3,
        description: 'Establish yourself as a premier logistics contractor with a high reputation across the Niger Delta.',
        giverName: 'Chief Dumo',
        giverRole: 'Energy Syndicate Chairman',
        giverAvatar: '🚢',
        status: 'locked',
        objectives: [
          { id: 'obj_p3_cred', description: 'Reach 60+ Street Cred and own at least 1 business or property', isCompleted: false },
        ],
        rewards: {
          cash: 200000,
          streetCred: 50,
          careerXp: 200,
          itemReward: {
            id: 'oilfield_shares',
            name: 'Maritime Pipeline Freight Certificate',
            category: 'document',
            icon: '🚢',
            description: 'Equity certificate in Trans-Amadi maritime logistics fleet.',
          },
        },
      },
    ];

    // Default active quest
    this.activeQuestId = 'quest_lagos_1';
    const q1 = this.quests.find((q) => q.id === 'quest_lagos_1');
    if (q1) q1.status = 'active';
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.quests)) {
          for (const s of parsed.quests) {
            const existing = this.quests.find((q) => q.id === s.id);
            if (existing) {
              existing.status = s.status;
              if (Array.isArray(s.objectives)) {
                existing.objectives.forEach((obj, idx) => {
                  if (s.objectives[idx]) {
                    obj.isCompleted = s.objectives[idx].isCompleted;
                  }
                });
              }
            }
          }
        }
        if (parsed.activeQuestId) {
          this.activeQuestId = parsed.activeQuestId;
        }
      }
    } catch {
      // Fallback
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          activeQuestId: this.activeQuestId,
          quests: this.quests.map((q) => ({
            id: q.id,
            status: q.status,
            objectives: q.objectives.map((o) => ({ id: o.id, isCompleted: o.isCompleted })),
          })),
        })
      );
    } catch {
      // Error
    }
    this.notifyListeners();
  }

  public subscribe(callback: (activeQuest: StoryQuest | null, allQuests: StoryQuest[]) => void): () => void {
    this.listeners.push(callback);
    callback(this.getActiveQuest(), [...this.quests]);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    const active = this.getActiveQuest();
    const all = [...this.quests];
    for (const listener of this.listeners) {
      listener(active, all);
    }
  }

  public getAllQuests(): StoryQuest[] {
    return [...this.quests];
  }

  public getQuestsByCity(city: QuestCity): StoryQuest[] {
    return this.quests.filter((q) => q.city === city);
  }

  public getActiveQuest(): StoryQuest | null {
    if (!this.activeQuestId) return null;
    return this.quests.find((q) => q.id === this.activeQuestId) || null;
  }

  public setActiveQuest(questId: string): boolean {
    const target = this.quests.find((q) => q.id === questId);
    if (!target || target.status === 'locked') return false;

    // Reset previous active if not completed
    const current = this.getActiveQuest();
    if (current && current.status === 'active') {
      current.status = 'available';
    }

    target.status = 'active';
    this.activeQuestId = questId;
    this.saveState();
    showGameToast(`🎯 Tracking Mission: ${target.title} (${target.arcName})`, 'info');
    return true;
  }

  public completeObjective(objectiveId: string): void {
    let changed = false;
    for (const q of this.quests) {
      if (q.status !== 'active') continue;
      const obj = q.objectives.find((o) => o.id === objectiveId);
      if (obj && !obj.isCompleted) {
        obj.isCompleted = true;
        changed = true;
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast(`✅ Objective Complete: ${obj.description}!`, 'success');

        // Check if all objectives complete
        const allDone = q.objectives.every((o) => o.isCompleted);
        if (allDone) {
          this.completeQuest(q.id);
        }
      }
    }
    if (changed) {
      this.saveState();
    }
  }

  public completeQuest(questId: string): void {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest || quest.status === 'completed') return;

    quest.status = 'completed';
    quest.objectives.forEach((o) => (o.isCompleted = true));

    // Pay rewards through backend
    const backend = BackendService.getInstance();
    if (quest.rewards.cash > 0) {
      backend.addCash(quest.rewards.cash);
    }
    if (quest.rewards.streetCred > 0) {
      backend.addStreetCred(quest.rewards.streetCred);
    }
    if (quest.rewards.careerXp > 0) {
      backend.addJobExperience(quest.rewards.careerXp);
    }
    if (quest.rewards.itemReward) {
      backend.addItem({
        ...quest.rewards.itemReward,
        price: 20000,
        usable: false,
      });
    }

    SoundEngine.getInstance().playTransactionSuccess();
    showGameToast(
      `🏆 CHAPTER COMPLETE: ${quest.title}!\nReceived ₦${quest.rewards.cash.toLocaleString()} Cash & +${quest.rewards.streetCred} Street Cred!`,
      'success',
      5500
    );

    // Unlock next chapter in arc if present
    const nextChapter = this.quests.find(
      (q) => q.arcName === quest.arcName && q.chapterNumber === quest.chapterNumber + 1
    );
    if (nextChapter && nextChapter.status === 'locked') {
      nextChapter.status = 'available';
      this.setActiveQuest(nextChapter.id);
    } else {
      this.activeQuestId = null;
    }

    this.saveState();
  }

  /**
   * Global event dispatcher to auto-progress matching quest objectives
   */
  public triggerEvent(eventType: 'eat' | 'work_shift' | 'drive' | 'arrive_city' | 'interact_object', data?: any): void {
    const active = this.getActiveQuest();
    if (!active) return;

    if (eventType === 'eat') {
      this.completeObjective('obj_l1_eat');
    } else if (eventType === 'work_shift') {
      this.completeObjective('obj_l1_work');
      this.completeObjective('obj_p2_repair');
    } else if (eventType === 'drive') {
      this.completeObjective('obj_l2_drive');
      this.completeObjective('obj_a1_cab');
    } else if (eventType === 'arrive_city') {
      if (data?.city === 'abuja') {
        this.completeObjective('obj_a1_arrive');
      } else if (data?.city === 'port_harcourt') {
        this.completeObjective('obj_p1_arrive');
      }
    } else if (eventType === 'interact_object') {
      const objId = data?.objectId;
      if (objId === 'flat-bed' || objId === 'dest_quilox' || objId === 'palm-view-flats') {
        this.completeObjective('obj_l3_residence');
      } else if (objId === 'abuja-secretariat') {
        this.completeObjective('obj_a2_tender');
      } else if (objId === 'aso-rock-lookout') {
        this.completeObjective('obj_a3_lookout');
      } else if (objId === 'nepa-generator' || objId === 'mechanic') {
        this.completeObjective('obj_p2_repair');
      }
    }

    // Check streetCred and wealth goals
    const stats = BackendService.getInstance().getData().stats;
    const cash = BackendService.getInstance().getData().walletCash + BackendService.getInstance().getData().bank.balance;
    if (stats.streetCred >= 35) {
      this.completeObjective('obj_l2_cred');
    }
    if (stats.streetCred >= 60) {
      this.completeObjective('obj_p3_cred');
    }
    if (cash >= 100000) {
      this.completeObjective('obj_l3_wealth');
    }
  }
}
