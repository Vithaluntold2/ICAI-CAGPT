import React, { useState } from 'react';

interface MotivationSettingsProps {
  onSettingsChange: (settings: MotivationSettings) => void;
}

interface MotivationSettings {
  soundEffects: boolean;
  visualCelebrations: boolean;
  progressAnimations: boolean;
  streakReminders: boolean;
  pointsSystem: boolean;
}

export const TransparentMotivation: React.FC<MotivationSettingsProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<MotivationSettings>({
    soundEffects: false,
    visualCelebrations: false,
    progressAnimations: true,
    streakReminders: false,
    pointsSystem: false
  });

  const updateSetting = (key: keyof MotivationSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-yellow-900 mb-4">
        🧠 Motivation Psychology Settings
      </h3>
      
      <p className="text-yellow-800 mb-4 text-sm">
        These features use behavioral psychology to make learning more engaging. 
        You can control which ones you want active. We're being transparent about 
        how we're trying to motivate you.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-yellow-900">Sound Effects</label>
            <p className="text-xs text-yellow-700">Pleasant chimes when you answer correctly (dopamine trigger)</p>
          </div>
          <input
            type="checkbox"
            checked={settings.soundEffects}
            onChange={(e) => updateSetting('soundEffects', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-yellow-900">Visual Celebrations</label>
            <p className="text-xs text-yellow-700">Particle effects and animations for achievements (reward conditioning)</p>
          </div>
          <input
            type="checkbox"
            checked={settings.visualCelebrations}
            onChange={(e) => updateSetting('visualCelebrations', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-yellow-900">Progress Animations</label>
            <p className="text-xs text-yellow-700">Smooth progress bars and counters (sense of advancement)</p>
          </div>
          <input
            type="checkbox"
            checked={settings.progressAnimations}
            onChange={(e) => updateSetting('progressAnimations', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-yellow-900">Streak Reminders</label>
            <p className="text-xs text-yellow-700">Daily notifications to maintain learning streaks (habit formation)</p>
          </div>
          <input
            type="checkbox"
            checked={settings.streakReminders}
            onChange={(e) => updateSetting('streakReminders', e.target.checked)}
            className="w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-yellow-900">Points System</label>
            <p className="text-xs text-yellow-700">Earn points for activities (external motivation/gamification)</p>
          </div>
          <input
            type="checkbox"
            checked={settings.pointsSystem}
            onChange={(e) => updateSetting('pointsSystem', e.target.checked)}
            className="w-4 h-4"
          />
        </div>
      </div>

      <div className="mt-4 p-3 bg-yellow-100 rounded text-xs text-yellow-800">
        <strong>Research Note:</strong> External motivators can be helpful for building initial habits, 
        but the goal is to develop intrinsic motivation for financial learning. Consider gradually 
        reducing these features as you build natural interest in the subject.
      </div>
    </div>
  );
};