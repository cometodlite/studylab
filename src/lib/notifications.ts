export type AppNotificationVariant = 'achievement' | 'goal' | 'info';

export interface GoalAlert {
  id: string;
  title: string;
  message: string;
  emoji?: string;
  href?: string;
}

export interface AppNotificationDetail extends GoalAlert {
  variant?: AppNotificationVariant;
}
