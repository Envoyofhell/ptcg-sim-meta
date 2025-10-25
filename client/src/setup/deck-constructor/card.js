import {
  doubleClick,
  imageClick,
  openCardContextMenu,
} from '../image-logic/click-events.js';
import {
  dragEnd,
  dragLeave,
  dragOver,
  dragStart,
} from '../image-logic/drag.js';
import { resetImage } from '../image-logic/reset-image.js';
import {
  handleCardHoverStart,
  handleCardHoverEnd,
  handleCardHoverMove,
  setDragState,
  setRightClickState,
} from '../image-logic/hover-preview.js';
import { protectedImageLoader } from '../../utils/protected-image-loader.js';

export class Card {
  name;
  type;
  user;
  image;

  constructor(user, name, type, imageURL) {
    this.user = user;
    this.name = name;
    this.type = type;
    this.originalImageURL = imageURL;
    
    // Create image element immediately (CORS disabled for now)
    this.imageAttributes = {
      user: this.user,
      type: this.type,
      src: imageURL, // Use original URL directly
      alt: this.name,
      draggable: true,
      click: imageClick,
      dblclick: doubleClick,
      dragstart: dragStart,
      dragover: dragOver,
      dragleave: dragLeave,
      dragend: dragEnd,
      contextmenu: openCardContextMenu,
    };
    this.buildImage(this.imageAttributes);
  }

  async loadProtectedImage(imageURL) {
    try {
      // Check CORS rules and get allowed URL
      const allowedURL = await protectedImageLoader.loadImage(imageURL, {
        name: this.name,
        type: this.type,
        user: this.user
      });
      
      this.imageAttributes = {
        user: this.user,
        type: this.type,
        src: allowedURL,
        alt: this.name,
        draggable: true,
        click: imageClick,
        dblclick: doubleClick,
        dragstart: dragStart,
        dragover: dragOver,
        dragleave: dragLeave,
        dragend: dragEnd,
        contextmenu: openCardContextMenu,
        mouseenter: handleCardHoverStart,
        mouseleave: handleCardHoverEnd,
        mousemove: handleCardHoverMove,
      };
      this.buildImage(this.imageAttributes);
    } catch (error) {
      console.warn(`Failed to load protected image for ${this.name}:`, error);
      // Fallback to original URL if CORS check fails
      this.imageAttributes = {
        user: this.user,
        type: this.type,
        src: imageURL,
        alt: this.name,
        draggable: true,
        click: imageClick,
        dblclick: doubleClick,
        dragstart: dragStart,
        dragover: dragOver,
        dragleave: dragLeave,
        dragend: dragEnd,
        contextmenu: openCardContextMenu,
        mouseenter: handleCardHoverStart,
        mouseleave: handleCardHoverEnd,
        mousemove: handleCardHoverMove,
      };
      this.buildImage(this.imageAttributes);
    }
  }

  buildImage(imageAttributes) {
    this.image = document.createElement('img');
    for (const attr in imageAttributes) {
      if (typeof imageAttributes[attr] === 'function') {
        this.image.addEventListener(attr, imageAttributes[attr]);
      } else if (attr === 'user') {
        this.image.user = imageAttributes[attr];
      } else if (attr === 'type') {
        this.image.type = imageAttributes[attr];
      } else {
        this.image.setAttribute(attr, imageAttributes[attr]);
      }
    }
    resetImage(this.image);
  }
}
