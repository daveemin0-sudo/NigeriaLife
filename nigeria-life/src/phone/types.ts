export type PhoneAppId = 'home' | 'bank' | 'messages' | 'map' | 'jobs' | 'dating' | 'music' | 'invest';

export interface PhoneContact {
  id: string;
  name: string;
  avatar: string;
  status: string;
  lastMessage: string;
  unread: boolean;
  messages: {
    sender: 'them' | 'me';
    text: string;
    time: string;
  }[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  pay: number;
  energyCost: number;
  durationSeconds: number;
  description: string;
  icon: string;
}

export interface DatingProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  avatar: string;
  liked: boolean;
}
