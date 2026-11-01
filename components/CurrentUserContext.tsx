"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export type CurrentUserProfile = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type CurrentUserContextValue = {
  userId: string | null;
  profile: CurrentUserProfile | null;
  setProfile: Dispatch<SetStateAction<CurrentUserProfile | null>>;
  ready: boolean;
  profileReady: boolean;
};

export const CurrentUserContext = createContext<CurrentUserContextValue>({
  userId: null,
  profile: null,
  setProfile: () => undefined,
  ready: false,
  profileReady: false,
});

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
