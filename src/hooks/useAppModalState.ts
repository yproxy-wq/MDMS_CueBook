import { useState } from 'react';
import type { Performance } from '../types';

/** Groups presentation-only overlays so App's domain logic does not own their storage details. */
export function useAppModalState() {
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetStep, setResetStep] = useState<'select' | 'confirm_app' | 'confirm_scenario'>('select');
  const [showPreferences, setShowPreferences] = useState(false);
  const [showLoginConfirmation, setShowLoginConfirmation] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [handoutCharacterId, setHandoutCharacterId] = useState<string | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<Performance[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
  const [isPhaseSearchOpen, setIsPhaseSearchOpen] = useState(false);
  const [isPhasePopupOpen, setIsPhasePopupOpen] = useState(false);
  const [isSoundPopupOpen, setIsSoundPopupOpen] = useState(false);

  return {
    isQuickActionsOpen, setIsQuickActionsOpen,
    isMenuOpen, setIsMenuOpen,
    showEndConfirmation, setShowEndConfirmation,
    showResetConfirmation, setShowResetConfirmation,
    resetStep, setResetStep,
    showPreferences, setShowPreferences,
    showLoginConfirmation, setShowLoginConfirmation,
    performanceModalOpen, setPerformanceModalOpen,
    showSessionSummary, setShowSessionSummary,
    historyModalOpen, setHistoryModalOpen,
    handoutCharacterId, setHandoutCharacterId,
    performanceHistory, setPerformanceHistory,
    showSyncModal, setShowSyncModal,
    isTimerDropdownOpen, setIsTimerDropdownOpen,
    isPhaseSearchOpen, setIsPhaseSearchOpen,
    isPhasePopupOpen, setIsPhasePopupOpen,
    isSoundPopupOpen, setIsSoundPopupOpen,
  };
}
