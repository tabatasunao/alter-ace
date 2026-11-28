import type { MoveInput } from './input';
import { Simulation } from './System';
import { AlertSystem } from './systems/AlertSystem';
import { AuraSystem } from './systems/AuraSystem';
import { BattleClockSystem } from './systems/BattleClockSystem';
import { DemoCameraSystem, FollowCameraSystem } from './systems/CameraSystems';
import { CentroidSystem } from './systems/CentroidSystem';
import { CleanupSystem } from './systems/CleanupSystem';
import { DemoDirectorSystem } from './systems/DemoDirectorSystem';
import { EffectSystem } from './systems/EffectSystem';
import { GrazeSystem } from './systems/GrazeSystem';
import { GridSystem } from './systems/GridSystem';
import { HealSystem } from './systems/HealSystem';
import { ImpactSystem } from './systems/ImpactSystem';
import { PlayerMovementSystem } from './systems/PlayerMovementSystem';
import { PlayerStatusSystem } from './systems/PlayerStatusSystem';
import { PlayerWeaponSystem } from './systems/PlayerWeaponSystem';
import { PraiseSystem } from './systems/PraiseSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { ReinforcementSystem } from './systems/ReinforcementSystem';
import { ReleaseSystem } from './systems/ReleaseSystem';
import { SeparationSystem } from './systems/SeparationSystem';
import { ShieldSystem } from './systems/ShieldSystem';
import { SoldierAISystem } from './systems/SoldierAISystem';
import { StalkSystem } from './systems/StalkSystem';
import { TutorialSystem } from './systems/TutorialSystem';
import { UnitActionSystem } from './systems/UnitActionSystem';
import { VictorySystem } from './systems/VictorySystem';

/**
 * The order systems run in each step. To add a mechanic, write a System and slot it in here;
 * nothing else needs to change.
 */
export function battlePipeline(input: MoveInput): Simulation {
  return new Simulation([
    new GridSystem(),
    new SeparationSystem(),
    new CentroidSystem(),
    new AuraSystem(),
    new HealSystem(),
    new ShieldSystem(),
    new PlayerStatusSystem(),
    new ReleaseSystem(),
    new PlayerMovementSystem(input),
    new PlayerWeaponSystem(),
    new StalkSystem(),
    new SoldierAISystem(),
    new UnitActionSystem(),
    new ProjectileSystem(),
    new GrazeSystem(),
    new EffectSystem(),
    new ImpactSystem(),
    new BattleClockSystem(),
    new ReinforcementSystem(),
    new AlertSystem(),
    new PraiseSystem(),
    new VictorySystem(),
    new CleanupSystem(),
    new FollowCameraSystem(),
  ]);
}

/**
 * The tutorial mission: the battle systems, with TutorialSystem in place of reinforcements, army
 * alerts and the victory check (the stages deploy the enemies, and the last stage wins).
 */
export function tutorialPipeline(input: MoveInput): Simulation {
  return new Simulation([
    new GridSystem(),
    new SeparationSystem(),
    new CentroidSystem(),
    new AuraSystem(),
    new HealSystem(),
    new ShieldSystem(),
    new PlayerStatusSystem(),
    new ReleaseSystem(),
    new PlayerMovementSystem(input),
    new PlayerWeaponSystem(),
    new StalkSystem(),
    new SoldierAISystem(),
    new UnitActionSystem(),
    new ProjectileSystem(),
    new GrazeSystem(),
    new EffectSystem(),
    new ImpactSystem(),
    new BattleClockSystem(),
    new PraiseSystem(),
    new TutorialSystem(),
    new CleanupSystem(),
    new FollowCameraSystem(),
  ]);
}

/** The hangar's background skirmish: armies only, no ace, restarts when a side is gone. */
export function demoPipeline(): Simulation {
  return new Simulation([
    new GridSystem(),
    new SeparationSystem(),
    new CentroidSystem(),
    new AuraSystem(),
    new HealSystem(),
    new ShieldSystem(),
    new SoldierAISystem(),
    new UnitActionSystem(),
    new ProjectileSystem(),
    new EffectSystem(),
    new DemoDirectorSystem(),
    new CleanupSystem(),
    new DemoCameraSystem(),
  ]);
}
