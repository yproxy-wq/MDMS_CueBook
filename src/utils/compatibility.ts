import { Scenario } from '../types';
import { validateAndMigrateScenario as validatorMigrate } from './scenarioValidator';

/**
 * ============================================================================
 * CUEBOOK DATA COMPATIBILITY LAYER
 * ============================================================================
 * 既存ユーザーの設定ファイル（JSON）を読み込む際の互換性を維持するためのユーティリティ。
 * scenarioValidatorの堅牢なアトミックエンジンを呼び出します。
 * ============================================================================
 */

export function validateAndMigrateScenario(data: unknown): Scenario {
  return validatorMigrate(data);
}

