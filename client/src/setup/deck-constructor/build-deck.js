import { systemState } from '../../front-end.js';
import { determineDeckData } from '../general/determine-deckdata.js';
import { getZone } from '../zones/get-zone.js';
import { Card } from './card.js';
import { Cover } from './cover.js';
import { protectedImageLoader } from '../../utils/protected-image-loader.js';

export const buildDeck = (user) => {
  const deckData = determineDeckData(user);
  const deck = getZone(user, 'deck');
  for (const [quantity, name, type, imageURL] of deckData) {
    for (let i = 0; i < quantity; i++) {
      const card = new Card(user, name, type, imageURL);
      deck.array.push(card);
      deck.element.appendChild(card.image);
    }
  }
  const targetCardBackSrc =
    user === 'self'
      ? systemState.cardBackSrc
      : systemState.isTwoPlayer
        ? systemState.p2OppCardBackSrc
        : systemState.p1OppCardBackSrc;
  const cover = new Cover(user, 'deckCover', targetCardBackSrc);
  deck.elementCover.appendChild(cover.image);

  // Preload images with CORS protection
  const imageUrls = deck.array.map(card => card.image.src);
  const cardData = deck.array.map(card => ({
    name: card.name,
    type: card.type,
    user: card.user
  }));
  
  protectedImageLoader.preloadImages(imageUrls, cardData)
    .then(results => {
      console.log(`Preloaded ${results.length} images with CORS protection`);
      const blockedCount = results.filter(r => r.blocked).length;
      if (blockedCount > 0) {
        console.log(`${blockedCount} images were blocked by CORS rules`);
      }
    })
    .catch(error => {
      console.warn('Error preloading images:', error);
    });
};
