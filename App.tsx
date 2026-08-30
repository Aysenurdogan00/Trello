import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import axios from 'axios';

// ⚠️ Kendi bilgisayarının IP adresini buraya yaz!
const API_URL = 'https://trello-clone-backend-cs8r.onrender.com/api';

interface Task {
  id: number | string;
  title: string;
  status: 'TODO' | 'DOING' | 'DONE';
  category?: string;
  created_at?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  const [loading, setLoading] = useState(false);

  // Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Kanban State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Yazılım');
  const [activeTab, setActiveTab] = useState<'TODO' | 'DOING' | 'DONE'>('TODO');

  const categories = ['Yazılım', 'Ofis', 'Kişisel', 'Finans', 'Toplantı', 'Sağlık'];

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Yeni';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchTasks = async (currentToken: string) => {
    try {
      const response = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Görev çekme hatası:', error);
    }
  };

  const handleAuthSubmit = async () => {
    if (authStep === 'LOGIN' && (!authEmail.trim() || !authPassword.trim())) {
      Alert.alert('Eksik Bilgi', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    if (authStep === 'REGISTER' && (!authUsername.trim() || !authEmail.trim() || !authPassword.trim())) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }
    if (authStep === 'VERIFY' && !verificationCode.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen 6 haneli doğrulama kodunu girin.');
      return;
    }

    setLoading(true);

    try {
      if (authStep === 'REGISTER') {
        await axios.post(`${API_URL}/auth/register`, {
          username: authUsername,
          email: authEmail,
          password: authPassword,
        }, { timeout: 8000 });

        Alert.alert('Başarılı 📩', 'Doğrulama kodu e-postanıza gönderildi!');
        setAuthStep('VERIFY');
      } else if (authStep === 'VERIFY') {
        await axios.post(`${API_URL}/auth/verify`, {
          email: authEmail,
          code: verificationCode,
        }, { timeout: 8000 });

        Alert.alert('Tebrikler 🎉', 'E-posta doğrulandı! Şimdi giriş yapabilirsiniz.');
        setAuthStep('LOGIN');
      } else {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email: authEmail,
          password: authPassword,
        }, { timeout: 8000 });

        const { token: jwtToken, user: userData } = response.data;
        setToken(jwtToken);
        setUser(userData);
        fetchTasks(jwtToken);
      }
    } catch (err: any) {
      let errorMsg = 'Sunucuya ulaşılamadı. Lütfen IP adresini ve sunucuyu kontrol edin.';
      if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }
      Alert.alert('İşlem Başarısız ❌', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ÇIKIŞ YAPMA (TÜM INPUTLARI VE BİLGİLERİ TEMİZLEME)
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthUsername('');
    setVerificationCode('');
    setTasks([]);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !token) return;

    try {
      const response = await axios.post(
        `${API_URL}/tasks`,
        {
          title: newTaskTitle,
          status: 'TODO',
          category: selectedCategory,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTasks((prev) => [...prev, response.data]);
      setNewTaskTitle('');
    } catch (error) {
      Alert.alert('Hata', 'Görev eklenemedi.');
    }
  };

  const handleStatusChange = async (id: number | string, newStatus: Task['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );

    try {
      await axios.put(
        `${API_URL}/tasks/${id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (token) fetchTasks(token);
    }
  };

  const handleDeleteTask = async (id: number | string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await axios.delete(`${API_URL}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      if (token) fetchTasks(token);
    }
  };

  // --- GÖRSEL ARKA PLANLI GİRİŞ / KAYIT EKRANI ---
  if (!user) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1000&auto=format&fit=crop' }}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.authOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
          <View style={styles.authContainer}>
            <View style={styles.authCard}>
              <View style={styles.logoBadge}>
                <Text style={{ fontSize: 24 }}>📋</Text>
              </View>
              <Text style={styles.authTitle}>
                {authStep === 'REGISTER' && 'Hesap Oluştur'}
                {authStep === 'LOGIN' && 'Hoş Geldiniz'}
                {authStep === 'VERIFY' && 'E-posta Doğrulama'}
              </Text>

              {authStep === 'REGISTER' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Kullanıcı Adı"
                    placeholderTextColor="#94a3b8"
                    value={authUsername}
                    onChangeText={setAuthUsername}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="E-posta"
                    placeholderTextColor="#94a3b8"
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    placeholderTextColor="#94a3b8"
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    secureTextEntry
                  />
                </>
              )}

              {authStep === 'LOGIN' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="E-posta"
                    placeholderTextColor="#94a3b8"
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    placeholderTextColor="#94a3b8"
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    secureTextEntry
                  />
                </>
              )}

              {authStep === 'VERIFY' && (
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="6 Haneli Kod"
                  placeholderTextColor="#94a3b8"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAuthSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {authStep === 'REGISTER' && 'Kayıt Ol'}
                    {authStep === 'LOGIN' && 'Giriş Yap'}
                    {authStep === 'VERIFY' && 'Doğrula'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthUsername('');
                  setVerificationCode('');
                  setAuthStep(authStep === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.switchAuthText}>
                  {authStep === 'LOGIN' ? 'Hesabın yok mu? Kayıt Ol' : 'Zaten hesabın var mı? Giriş Yap'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // --- KANBAN MOBİL EKRANI ---
  const currentTasks = tasks.filter((t) => t.status === activeTab);

  const getTabBorderColor = () => {
    if (activeTab === 'TODO') return '#f59e0b';
    if (activeTab === 'DOING') return '#3b82f6';
    return '#10b981';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#616265" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <View style={styles.iconDot} />
            <View style={styles.iconDot} />
            <View style={styles.iconDot} />
          </View>
          <Text style={styles.headerTitle}>Planlama Panosu</Text>
        </View>

        <View style={styles.userSection}>
          <View style={styles.userBadge}>
            <Text style={{ fontSize: 12 }}>👤</Text>
            <Text style={styles.usernameText}>{user.username}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        {/* Görev Ekleme Formu */}
        <View style={styles.addSection}>
          <TextInput
            style={styles.addInput}
            placeholder="+ Yeni görev ekle..."
            placeholderTextColor="#94a3b8"
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
            <Text style={styles.addButtonText}>Görev Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Kategori Seçim Çipleri */}
        <View style={{ height: 38, marginBottom: 12 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === item && styles.selectedCategoryChip,
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === item && styles.selectedCategoryChipText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Tab Geçiş Butonları */}
        <View style={styles.tabContainer}>
          {(['TODO', 'DOING', 'DONE'] as const).map((tab) => {
            const count = tasks.filter((t) => t.status === tab).length;
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  isSelected && styles.activeTabButton,
                  isSelected && {
                    borderBottomWidth: 3,
                    borderBottomColor:
                      tab === 'TODO' ? '#f59e0b' : tab === 'DOING' ? '#3b82f6' : '#10b981',
                  },
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    isSelected && styles.activeTabText,
                    isSelected && {
                      color:
                        tab === 'TODO' ? '#b45309' : tab === 'DOING' ? '#1d4ed8' : '#047857',
                    },
                  ]}
                >
                  {tab === 'TODO' && 'Yapılacaklar'}
                  {tab === 'DOING' && 'Devam Edenler'}
                  {tab === 'DONE' && 'Tamamlananlar'} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Görev Kartları Listesi */}
        <FlatList
          data={currentTasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, { borderLeftColor: getTabBorderColor() }]}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle}>{item.title}</Text>

                <View style={styles.dateAndDeleteRow}>
                  <Text style={styles.dateBadge}>⏱️ {formatDate(item.created_at)}</Text>
                  <TouchableOpacity onPress={() => handleDeleteTask(item.id)}>
                    <Text style={styles.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.taskFooter}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category || 'Görev'}</Text>
                </View>

                <View style={styles.actionButtons}>
                  {item.status !== 'TODO' && (
                    <TouchableOpacity
                      style={[styles.statusBtn, { backgroundColor: '#f59e0b' }]}
                      onPress={() => handleStatusChange(item.id, 'TODO')}
                    >
                      <Text style={styles.statusBtnText}>← Yapılacak</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'DONE' && (
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        { backgroundColor: item.status === 'TODO' ? '#3b82f6' : '#10b981' },
                      ]}
                      onPress={() =>
                        handleStatusChange(item.id, item.status === 'TODO' ? 'DOING' : 'DONE')
                      }
                    >
                      <Text style={styles.statusBtnText}>İlerle →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, width: '100%', height: '100%' },
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 10,
  },
  logoBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  authTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  input: {
    width: '100%',
    height: 46,
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#0f172a',
  },
  codeInput: { textAlign: 'center', fontSize: 20, letterSpacing: 6, fontWeight: 'bold' },
  primaryButton: {
    width: '100%',
    height: 46,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  switchAuthText: { color: '#2563eb', marginTop: 16, fontSize: 13, fontWeight: '500' },

  safeArea: {
    flex: 1,
    backgroundColor: '#616265',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 56,
    backgroundColor: '#616265',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 22,
    height: 22,
    backgroundColor: '#38bdf8',
    borderRadius: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 3,
  },
  iconDot: { width: 7, height: 7, backgroundColor: '#0f172a', borderRadius: 1 },
  headerTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  usernameText: { color: '#f8fafc', fontSize: 12, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#1e293b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  logoutText: { color: 'white', fontSize: 12, fontWeight: '600' },

  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  addSection: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 12,
  },
  addInput: { flex: 1, height: 38, paddingHorizontal: 10, fontSize: 14, color: '#1e293b' },
  addButton: {
    backgroundColor: '#51545d',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },

  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
    justifyContent: 'center',
  },
  selectedCategoryChip: { backgroundColor: '#51545d' },
  categoryChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  selectedCategoryChipText: { color: 'white' },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: 'white' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  activeTabText: { fontWeight: '700' },

  taskCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1, marginRight: 8 },
  dateAndDeleteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateBadge: {
    fontSize: 10,
    color: '#64748b',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deleteText: { color: '#94a3b8', fontSize: 14, padding: 2 },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  categoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryBadgeText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBtnText: { color: 'white', fontSize: 11, fontWeight: '600' },
});