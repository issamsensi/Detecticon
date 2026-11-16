export type Suspect = {
  id: string;
  name: string;
  role: string;
  color: number;
  testimony: string;
  alibiProof?: string;
  contradiction?: string;
  isKiller: boolean;
};

export type Puzzle = {
  id: string;
  number: number;
  title: string;
  scene: string;
  suspects: Suspect[];
};

export type PublicSuspect = Pick<Suspect, 'id' | 'name' | 'role' | 'color' | 'testimony'>;

export type PublicPuzzle = {
  id: string;
  number: number;
  title: string;
  scene: string;
  suspects: PublicSuspect[];
};

