import { DogmaPanel, DogmaStage } from './DogmaViews';

export const CentralDogmaStage = () => <DogmaStage mode="dogma" />;
export const CentralDogmaPanel = () => <DogmaPanel mode="dogma" />;
export const MutationStage = () => <DogmaStage mode="mutation" />;
export const MutationPanel = () => <DogmaPanel mode="mutation" />;
