import { render, screen } from '@testing-library/react-native';
import App from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// TanStack Query starts a five-minute cache cleanup timer when App unmounts.
jest.useFakeTimers();

test('shows a loading indicator while the training overview is fetched', async () => {
  jest.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

  await render(<App />);

  expect(screen.getByLabelText('Loading training data')).toBeOnTheScreen();
});
