# 🔧 Instruções para Recompilar o Módulo Nativo

O `BubbleModule` precisa ser compilado no código nativo Android. Siga estes passos:

## ⚠️ Problema
Se você ver este erro:
```
ERROR Erro ao ativar bolha: [TypeError: Cannot read property 'hasOverlayPermission' of null]
```

Significa que o módulo nativo não foi compilado.

## ✅ Solução

### Opção 1: Rebuild Completo (Recomendado)

```bash
# 1. Limpar cache e builds anteriores
cd android
./gradlew clean
cd ..

# 2. Recompilar o projeto nativo
npx expo prebuild --clean

# 3. Compilar e instalar no dispositivo
npx expo run:android
```

### Opção 2: Usando Dev Client (Mais rápido para desenvolvimento)

```bash
# 1. Recompilar apenas o módulo nativo
npx expo prebuild

# 2. Compilar o APK de desenvolvimento
cd android
./gradlew assembleDebug
cd ..

# 3. Instalar no dispositivo
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 4. Iniciar o Metro bundler
npx expo start --dev-client
```

### Opção 3: Build com EAS (Produção)

```bash
# Se você usa EAS Build
eas build --platform android --profile development
```

## 🔍 Verificar se Funcionou

Após recompilar, você deve ver nos logs:
```
✅ Bolha ativada com sucesso
```

E **NÃO** deve ver:
```
⚠️ BubbleModule não disponível
```

## 📱 Testar

1. Abra o app no dispositivo
2. Fique online
3. Minimize o app (botão Home)
4. A bolha flutuante deve aparecer na tela

Se ainda não funcionar, verifique:
- ✅ Permissão "Exibir sobre outros apps" está ativada nas configurações do Android
- ✅ O app foi instalado após o rebuild (não está usando versão antiga)
- ✅ Você está usando o dev client compilado, não o Expo Go

