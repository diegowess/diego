// AppNavigator.js
import { createStackNavigator } from '@react-navigation/stack';
import BuscarLocal from '../screens/buscarlocal';
import CarteiraScreen from '../screens/CarteiraScreen';
import Chat from '../screens/chat';
import Corrida from '../screens/corrida';
import Historico from '../screens/historico';
import Inicio from '../screens/inicio';
import Login from '../screens/login';
import Perfil from '../screens/perfil';
import SignUp from '../screens/signup';
import Suporte from '../screens/suporte';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen 
        name="Inicio" 
        component={Inicio} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Suporte" 
        component={Suporte} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Login" 
        component={Login} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BuscarLocal" 
        component={BuscarLocal} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Corrida" 
        component={Corrida} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Historico" 
        component={Historico} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
  name="Carteira" 
  component={CarteiraScreen}
  options={{ title: 'Carteira' }}
/>
      <Stack.Screen 
        name="Perfil" 
        component={Perfil} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Chat" 
        component={Chat}
        options={{ 
          title: 'Chat com Motorista',
          headerBackTitle: 'Voltar'
        }}
      />
      <Stack.Screen 
        name="SignUp" 
        component={SignUp}
        options={{ 
          title: 'Cadastro',
          headerBackTitle: 'Voltar'
        }}
      />
    </Stack.Navigator>
  );
}