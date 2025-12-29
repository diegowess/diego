# Exemplos de Uso do Zustand

## 🎯 Quando Usar

**Zustand é útil quando:**

- ✅ Estado precisa ser compartilhado entre múltiplas telas
- ✅ Você está lendo `AsyncStorage` em várias telas
- ✅ Você está passando props através de muitas camadas (props drilling)
- ✅ Estado precisa persistir entre sessões

**Context API seria melhor quando:**

- Estado é usado apenas em uma árvore específica de componentes
- Você precisa de providers aninhados complexos

## 📋 Exemplos Práticos

### 1. Login (substituir AsyncStorage)

**Antes:**

```javascript
await AsyncStorage.setItem('user_data', JSON.stringify(userPayload));
navigation.replace('Inicio');
```

**Depois:**

```javascript
import { useAuthStore } from '../store/useAuthStore';

const { setUser } = useAuthStore();

// No handleLogin:
if (data.success) {
  setUser(data.user || userPayload); // Salva no store E no AsyncStorage
  navigation.replace('Inicio');
}
```

### 2. Ler dados do usuário em qualquer tela

**Antes:**

```javascript
const [motoristaId, setMotoristaId] = useState(null);

useEffect(() => {
  const loadUser = async () => {
    const stored = await AsyncStorage.getItem('user_data');
    if (stored) {
      const user = JSON.parse(stored);
      setMotoristaId(user?.id || user?.motorista_id);
    }
  };
  loadUser();
}, []);
```

**Depois:**

```javascript
import { useAuthStore } from '../store/useAuthStore';

const { motoristaId, loadUser } = useAuthStore();

useEffect(() => {
  loadUser();
}, []);
```

### 3. Estado online compartilhado

**Antes:**

```javascript
// Tela Inicio
const [online, setOnline] = useState(false);

// Tela Corrida - não sabe se está online
const { online } = route.params || {}; // Precisa passar via params
```

**Depois:**

```javascript
// Tela Inicio
import { useAppStore } from '../store/useAppStore';
const { online, setOnline } = useAppStore();

// Tela Corrida - acesso direto!
import { useAppStore } from '../store/useAppStore';
const { online } = useAppStore(); // Sempre sincronizado!
```

### 4. Saldo do dia compartilhado

**Antes:**

```javascript
// Tela Inicio
const [saldoDia, setSaldoDia] = useState(0);

// Tela Carteira - precisa passar via params ou ler novamente
```

**Depois:**

```javascript
// Tela Inicio
import { useAppStore } from '../store/useAppStore';
const { saldoDia, setSaldoDia } = useAppStore();

// Tela Carteira - acesso direto!
import { useAppStore } from '../store/useAppStore';
const { saldoDia } = useAppStore(); // Sempre atualizado!
```

### 5. Corrida atual compartilhada

**Antes:**

```javascript
// Tela Inicio
const [corridaAtual, setCorridaAtual] = useState(null);
navigation.navigate('Corrida', { corrida: corridaAtual });
```

**Depois:**

```javascript
// Tela Inicio
import { useAppStore } from '../store/useAppStore';
const { setCorridaAtual } = useAppStore();

setCorridaAtual(corrida);
navigation.navigate('Corrida'); // Não precisa passar via params!

// Tela Corrida
import { useAppStore } from '../store/useAppStore';
const { corridaAtual } = useAppStore(); // Já está disponível!
```

## 🔄 Migração Gradual

Você pode migrar gradualmente:

1. **Fase 1**: Usar Zustand apenas para `user/motoristaId`
2. **Fase 2**: Adicionar estado `online` e `saldoDia`
3. **Fase 3**: Mover estado de corrida
4. **Fase 4**: Remover props drilling desnecessário

## ⚠️ Quando NÃO Usar Zustand

- Estado local de um componente (use `useState`)
- Estado de formulário temporário (use `useState`)
- Estado que não é compartilhado (use `useState`)

## 💡 Dica

Zustand é **seletivo** - apenas componentes que usam o estado específico re-renderizam:

```javascript
// Este componente só re-renderiza quando 'online' muda
const { online } = useAppStore((state) => ({ online: state.online }));

// Este componente só re-renderiza quando 'saldoDia' muda
const { saldoDia } = useAppStore((state) => ({ saldoDia: state.saldoDia }));
```
