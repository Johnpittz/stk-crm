"use client";

import { createContext, useContext } from "react";

export interface UserProfile {
  email: string;
  nome: string;
  canal: string;
  cargo: string;
  avatar_url: string | null;
  whatsapp_instance: string | null;
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserProfile;
}) {
  return (
    <UserProfileContext.Provider value={user}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
