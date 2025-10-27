import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const bannerImg = require('@assets/images/Paw2MeBanner.png') as number;

/** Banner compacto, pegado a la izquierda, como FB. */
const FeedHeaderBanner: React.FC = () => {
  return (
    <View style={styles.wrap}>
      <Image
        source={bannerImg}
        style={styles.img}
        resizeMode="contain"
        accessible
        accessibilityLabel="Paw2Me"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    height: 52,
    paddingLeft: 15, // leve margen izquierdo (coincide con posts/composer)
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  img: {
    width: 118,
    height: '100%',
    alignSelf: 'flex-start',
  },
});

export default FeedHeaderBanner;
