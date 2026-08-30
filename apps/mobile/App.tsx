/**
 * @format
 */

import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { WeeklyPlanScreen } from './src/screens/WeeklyPlanScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <WeeklyPlanScreen />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
