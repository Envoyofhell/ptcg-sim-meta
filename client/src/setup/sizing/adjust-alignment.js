// Check if there's a horizontal overflow
const checkHorizontalOverflow = (element) => {
  return element.scrollWidth > element.clientWidth;
};

// Check if there's a vertical overflow
const checkVerticalOverflow = (element) => {
  return element.scrollHeight > element.clientHeight;
};

// Adjust the alignment based on the overflow
export const adjustAlignment = (element) => {
  if (checkHorizontalOverflow(element)) {
    element.style.justifyContent = 'flex-start';
  } else {
    element.style.justifyContent = 'center';
  }

  if (checkVerticalOverflow(element)) {
    element.style.alignItems = 'flex-start';
  } else {
    element.style.alignItems = 'center';
  }
};