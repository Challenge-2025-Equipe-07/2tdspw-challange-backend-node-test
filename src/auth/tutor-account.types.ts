export type TutorPetClaim = {
  id: string;
  name: string;
  breed: string;
  sex: 'M' | 'F';
  weight: number;
  age: number;
  isCastrated: boolean;
  species: string;
};

export type TutorProfile = {
  name: string;
  email: string;
  telephone: string;
  document: string;
  pets: TutorPetClaim[];
};

export type TutorClaims = {
  role: 'tutor';
  email: string;
  document: string;
  pets: TutorPetClaim[];
};
