import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { reverseGeocode } from '@services/geoService';

const GeocodeTestScreen: React.FC = () => {
  const [out, setOut] = useState<string>('(sin probar)');
  const test = async () => {
    try {
      // Ángel de la Independencia
      const lat = 19.426972;
      const lng = -99.167664;
      const info = await reverseGeocode(lat, lng);
      setOut(JSON.stringify(info));
      console.log('[TEST] reverse', info);
    } catch (e) {
      setOut(String(e));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Button mode="contained" onPress={test}>
          Probar reverse geocode
        </Button>
        <Text style={{ marginTop: 12 }}>{out}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  body: { flex: 1, justifyContent: 'center' },
});

export default GeocodeTestScreen;
