import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';

test('renders the app name and platform', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const texts = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(texts).toEqual(['TrainIQ', 'Mobile']);
});
