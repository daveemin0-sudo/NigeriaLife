export type QuestCity = 'lagos' | 'abuja' | 'port_harcourt';
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

export interface QuestObjective {
  id: string;
  description: string;
  isCompleted: boolean;
  targetCount?: number;
  currentCount?: number;
}

export interface QuestReward {
  cash: number;
  streetCred: number;
  careerXp: number;
  itemReward?: {
    id: string;
    name: string;
    category: 'document' | 'tool' | 'luxury';
    icon: string;
    description: string;
  };
}

export interface StoryQuest {
  id: string;
  title: string;
  arcName: string; // e.g. "From Aguda to Banana Island"
  city: QuestCity;
  chapterNumber: number;
  description: string;
  giverName: string;
  giverRole: string;
  giverAvatar: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  status: QuestStatus;
}
