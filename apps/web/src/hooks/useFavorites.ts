"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

const STORAGE_KEY = "straits-favorites";

interface UseFavoritesResult {
  favorites: string[];
  isFavorite: (agentId: string) => boolean;
  toggleFavorite: (agentId: string) => void;
  addFavorite: (agentId: string) => void;
  removeFavorite: (agentId: string) => void;
  loading: boolean;
}

export function useFavorites(): UseFavoritesResult {
  const { address, isConnected } = useAccount();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    async function loadFavorites() {
      setLoading(true);

      if (isConnected && address) {
        // Try to load from API for authenticated users
        try {
          const response = await fetch(`/api/users/${address}/favorites`);
          if (response.ok) {
            const data = await response.json();
            setFavorites(data.favorites || []);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("Failed to fetch favorites from API:", err);
        }
      }

      // Fallback to localStorage for guests
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to load favorites from localStorage:", err);
      }

      setLoading(false);
    }

    loadFavorites();
  }, [address, isConnected]);

  // Save favorites to localStorage
  const saveFavorites = useCallback(
    (newFavorites: string[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
      } catch (err) {
        console.error("Failed to save favorites to localStorage:", err);
      }

      // Sync to API if authenticated
      if (isConnected && address) {
        fetch(`/api/users/${address}/favorites`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorites: newFavorites }),
        }).catch((err) =>
          console.error("Failed to sync favorites to API:", err)
        );
      }
    },
    [address, isConnected]
  );

  const isFavorite = useCallback(
    (agentId: string) => favorites.includes(agentId),
    [favorites]
  );

  const addFavorite = useCallback(
    (agentId: string) => {
      if (!favorites.includes(agentId)) {
        const newFavorites = [...favorites, agentId];
        setFavorites(newFavorites);
        saveFavorites(newFavorites);
      }
    },
    [favorites, saveFavorites]
  );

  const removeFavorite = useCallback(
    (agentId: string) => {
      const newFavorites = favorites.filter((id) => id !== agentId);
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  const toggleFavorite = useCallback(
    (agentId: string) => {
      if (isFavorite(agentId)) {
        removeFavorite(agentId);
      } else {
        addFavorite(agentId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    loading,
  };
}
