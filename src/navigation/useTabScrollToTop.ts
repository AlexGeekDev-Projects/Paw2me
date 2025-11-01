// src/navigation/useTabScrollToTop.ts
import * as React from 'react';
import {
  useIsFocused,
  useNavigation,
  StackActions,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

/**
 * Hook que replica el comportamiento de Facebook:
 * - Si el tab actual ya está enfocado:
 *    • Si estás en una ruta interna del stack → popToTop() y luego scrollToTop()
 *    • Si ya estás en el root → scrollToTop()
 * - Si el tab NO está enfocado, no hace nada aquí (el TabNavigator cambia de pestaña).
 */
export const useTabScrollToTop = (scrollToTop: () => void) => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  // ⬇️ Tipamos el padre como BottomTab para habilitar el evento 'tabPress'
  const parent = navigation.getParent<BottomTabNavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();

  React.useEffect(() => {
    if (!parent) return;
    const unsub = parent.addListener('tabPress', () => {
      if (!isFocused) return;

      const canGoBack = navigation.canGoBack?.() ?? false;
      if (canGoBack) {
        navigation.dispatch(StackActions.popToTop());
        requestAnimationFrame(() => scrollToTop());
      } else {
        scrollToTop();
      }
    });
    return unsub;
  }, [parent, isFocused, navigation, scrollToTop]);
};
