import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SectionList,
  SafeAreaView, Modal, BackHandler, StatusBar,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const DAY_OF_WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const CATEGORIES = ['주식', '간식', '문화생활', '잡화소모', '이동통신', '대중교통비', '뷰티', '기타'];

// ---------------------------------------------------------------------------
// 디자인 토큰 — "가계부(원장)" 컨셉: 깊은 포레스트 잉크 + 골드 스탬프 포인트.
// 카테고리마다 고유 색을 부여해 아이콘/배지/지출 분포 바에서 일관되게 사용한다.
// ---------------------------------------------------------------------------
const COLORS = {
  bg: '#F5F7F3',
  bgHeader: '#16281F',
  bgHeaderDeep: '#0E1B15',
  card: '#FFFFFF',
  ink: '#1C2321',
  inkSoft: '#6B756F',
  inkFaint: '#9AA39C',
  gold: '#C9A227',
  goldSoft: '#F3E9C9',
  forest: '#1B4332',
  forestDeep: '#0F2A20',
  forestSoft: '#E3ECE6',
  negative: '#A6414B',
  divider: '#E7E9E4',
  fieldBg: '#FAFBF9',
  white: '#FFFFFF',
};

const CATEGORY_COLORS = {
  '주식': '#1B4332',
  '간식': '#C9A227',
  '문화생활': '#46466B',
  '잡화소모': '#3C7A89',
  '이동통신': '#5B7C99',
  '대중교통비': '#B5533C',
  '뷰티': '#7C5295',
  '기타': '#8B7E74',
};

const CATEGORY_ICONS = {
  '주식': '🍚', '간식': '🍩', '문화생활': '🎬', '잡화소모': '🛒',
  '이동통신': '📱', '대중교통비': '🚌', '뷰티': '💄', '기타': '💳',
};

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const hexToRgba = (hex, alpha) => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const cardShadow = {
  shadowColor: '#0F1F17',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
};

// 조용히 실패해도 앱 흐름에 영향 없는 촉각 피드백 헬퍼
const hapticLight = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} };
const hapticSuccess = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {} };
const hapticWarning = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (e) {} };

// ---------------------------------------------------------------------------
// 공용 다이얼로그 — 기본 OS Alert 대신 앱 디자인과 통일된 커스텀 모달.
// 기존 Alert.alert(title, message, buttons) 호출부를 동일한 의미로 대체한다.
// ---------------------------------------------------------------------------
function AppModal({ visible, icon, iconColor, iconBg, title, message, actions = [], onRequestClose }) {
  const primaryActions = actions.filter(a => a.style !== 'cancel');
  const cancelAction = actions.find(a => a.style === 'cancel');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {icon ? (
            <View style={[styles.modalIconWrap, { backgroundColor: iconBg || COLORS.forestSoft }]}>
              <Ionicons name={icon} size={26} color={iconColor || COLORS.forest} />
            </View>
          ) : null}
          {title ? <Text style={styles.modalTitle}>{title}</Text> : null}
          {message ? <Text style={styles.modalMessage}>{message}</Text> : null}

          <View style={styles.modalActions}>
            {primaryActions.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.modalBtn, a.style === 'destructive' ? styles.modalBtnDestructive : styles.modalBtnPrimary]}
                onPress={a.onPress}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {cancelAction ? (
            <TouchableOpacity onPress={cancelAction.onPress} activeOpacity={0.7} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>{cancelAction.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('list');
  const [expenseList, setExpenseList] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('주식');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inputDate, setInputDate] = useState(new Date());

  const [isLoaded, setIsLoaded] = useState(false);
  const isFirstRender = useRef(true);
  const fabScale = useRef(new Animated.Value(1)).current;

  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', actions: [] });
  const closeDialog = () => setDialog(prev => ({ ...prev, visible: false }));
  const showDialog = ({ title, message, icon, iconColor, iconBg, actions = [{ label: '확인', style: 'primary' }] }) => {
    const wrapped = actions.map(a => ({
      ...a,
      onPress: () => { closeDialog(); a.onPress && a.onPress(); },
    }));
    setDialog({ visible: true, title, message, icon, iconColor, iconBg, actions: wrapped });
  };

  // 뒤로가기 버튼 제어
  useEffect(() => {
    const backAction = () => {
      if (dialog.visible) {
        closeDialog();
        return true;
      }
      if (currentView !== 'list') {
        setCurrentView('list');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentView, dialog.visible]);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('@expense_list');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          parsedData.sort((a, b) => b.timestamp - a.timestamp);
          setExpenseList(parsedData);
        }
      } catch (error) {
        console.error('데이터 불러오기 실패:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // 데이터 자동 저장
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('@expense_list', JSON.stringify(expenseList));
        } catch (error) {
          console.error('데이터 저장 실패:', error);
        }
      };
      saveData();
    }
  }, [expenseList, isLoaded]);

  /* ================= 백업 및 복원 로직 (핵심 동작은 기존과 동일, 알림 UI만 교체) ================= */
  const exportData = async () => {
    try {
      if (expenseList.length === 0) {
        showDialog({
          title: '알림', message: '백업할 데이터가 없습니다.',
          icon: 'information-circle-outline', iconColor: COLORS.gold, iconBg: COLORS.goldSoft,
        });
        return;
      }

      const jsonData = JSON.stringify(expenseList);
      const fileName = `expense_backup_${Date.now()}.json`;

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri, fileName, 'application/json'
            );
            await FileSystem.writeAsStringAsync(targetUri, jsonData, { encoding: FileSystem.EncodingType.UTF8 });
            hapticSuccess();
            showDialog({
              title: '완료', message: '선택하신 기기 폴더에 백업 파일이 안전하게 저장되었습니다.',
              icon: 'checkmark-circle-outline', iconColor: COLORS.forest, iconBg: COLORS.forestSoft,
            });
            return;
          } else {
            showDialog({
              title: '취소', message: '저장할 폴더가 선택되지 않았습니다.',
              icon: 'folder-open-outline', iconColor: COLORS.inkSoft, iconBg: COLORS.fieldBg,
            });
            return;
          }
        } catch (safError) {
          console.warn('직접 저장 실패, 공유 기능으로 대체합니다.', safError);
        }
      }

      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, jsonData, { encoding: FileSystem.EncodingType.UTF8 });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, { UTI: 'public.json', mimeType: 'application/json', dialogTitle: '가계부 백업' });
      }
    } catch (error) {
      showDialog({
        title: '오류', message: `데이터 백업 중 예상치 못한 문제가 발생했습니다.\n${error.message}`,
        icon: 'alert-circle-outline', iconColor: COLORS.negative, iconBg: hexToRgba(COLORS.negative, 0.12),
      });
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContents = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });

        let parsedData;
        try { parsedData = JSON.parse(fileContents); } catch (e) {
          showDialog({
            title: '오류', message: '유효한 가계부 백업(JSON) 파일이 아닙니다.',
            icon: 'alert-circle-outline', iconColor: COLORS.negative, iconBg: hexToRgba(COLORS.negative, 0.12),
          });
          return;
        }

        if (Array.isArray(parsedData) && parsedData.every(item => item.id && item.timestamp && item.name)) {
          showDialog({
            title: '데이터 복원', message: '어떻게 적용하시겠습니까?',
            icon: 'sync-outline', iconColor: COLORS.forest, iconBg: COLORS.forestSoft,
            actions: [
              {
                label: '기존 데이터와 병합', style: 'primary', onPress: () => {
                  const mergedData = [...expenseList];
                  parsedData.forEach(newItem => {
                    if (!mergedData.some(existingItem => existingItem.id === newItem.id)) mergedData.push(newItem);
                  });
                  mergedData.sort((a, b) => b.timestamp - a.timestamp);
                  setExpenseList(mergedData);
                  hapticSuccess();
                  showDialog({
                    title: '완료', message: '데이터가 성공적으로 병합되었습니다.',
                    icon: 'checkmark-circle-outline', iconColor: COLORS.forest, iconBg: COLORS.forestSoft,
                  });
                }
              },
              {
                label: '기존 데이터 지우고 덮어쓰기', style: 'destructive', onPress: () => {
                  parsedData.sort((a, b) => b.timestamp - a.timestamp);
                  setExpenseList(parsedData);
                  hapticSuccess();
                  showDialog({
                    title: '완료', message: '데이터가 덮어씌워졌습니다.',
                    icon: 'checkmark-circle-outline', iconColor: COLORS.forest, iconBg: COLORS.forestSoft,
                  });
                }
              },
              { label: '취소', style: 'cancel' },
            ],
          });
        } else {
          showDialog({
            title: '오류', message: '파일 구조가 올바르지 않거나 데이터가 손상되었습니다.',
            icon: 'alert-circle-outline', iconColor: COLORS.negative, iconBg: hexToRgba(COLORS.negative, 0.12),
          });
        }
      }
    } catch (error) {
      showDialog({
        title: '오류', message: '파일을 읽어오는 중 문제가 발생했습니다.',
        icon: 'alert-circle-outline', iconColor: COLORS.negative, iconBg: hexToRgba(COLORS.negative, 0.12),
      });
    }
  };

  /* ================= 포맷팅 및 핸들러 (기존 로직 그대로 유지) ================= */
  const getYearMonthString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${year}.${month}`;
  };

  const getDayString = (timestamp) => {
    const dateObj = new Date(timestamp);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${month}.${day}. ${DAY_OF_WEEK[dateObj.getDay()]}`;
  };

  const changeMonth = (offset) => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  const changeInputDate = (offsetDays) => setInputDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + offsetDays));

  const filteredList = expenseList.filter(item => {
    const itemDate = new Date(item.timestamp);
    return itemDate.getFullYear() === currentMonth.getFullYear() && itemDate.getMonth() === currentMonth.getMonth();
  });
  const totalMonthExpense = filteredList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const groupedData = filteredList.reduce((acc, item) => {
    const dateTitle = getDayString(item.timestamp);
    const existingSection = acc.find(section => section.title === dateTitle);
    if (existingSection) existingSection.data.push(item);
    else acc.push({ title: dateTitle, data: [item] });
    return acc;
  }, []);

  // 카테고리별 지출 분포 (요약 카드의 시각화용, 순수 파생 데이터)
  const categoryBreakdown = (() => {
    if (filteredList.length === 0) return [];
    const totals = {};
    filteredList.forEach(item => {
      totals[item.category] = (totals[item.category] || 0) + (Number(item.amount) || 0);
    });
    const arr = Object.keys(totals).map(cat => ({
      category: cat,
      amount: totals[cat],
      color: CATEGORY_COLORS[cat] || COLORS.inkFaint,
      percent: totalMonthExpense > 0 ? (totals[cat] / totalMonthExpense) * 100 : 0,
    }));
    arr.sort((a, b) => b.amount - a.amount);
    return arr;
  })();

  /* ================= 데이터 조작 (저장, 수정, 삭제) — 기존 로직 그대로 유지 ================= */
  const openInputView = () => {
    hapticLight();
    setEditingId(null);
    setInputDate(new Date());
    setExpenseName('');
    setExpenseAmount('');
    setStoreName('');
    setPaymentMethod('');
    setSelectedCategory('주식');
    setCurrentView('input');
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setInputDate(new Date(item.timestamp));
    setExpenseName(item.name);
    setExpenseAmount(item.amount.toString());
    setStoreName(item.store || '');
    setPaymentMethod(item.payment || '');
    setSelectedCategory(item.category);
    setCurrentView('input');
  };

  const saveExpense = () => {
    if (!expenseName.trim() || !expenseAmount.trim()) {
      showDialog({
        title: '알림', message: '소비 이름과 금액을 모두 입력해주세요.',
        icon: 'information-circle-outline', iconColor: COLORS.gold, iconBg: COLORS.goldSoft,
      });
      return;
    }

    if (isNaN(Number(expenseAmount.replace(/,/g, '')))) {
      showDialog({
        title: '알림', message: '금액은 숫자만 입력 가능합니다.',
        icon: 'information-circle-outline', iconColor: COLORS.gold, iconBg: COLORS.goldSoft,
      });
      return;
    }

    const now = new Date();
    const finalTimestamp = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).getTime();

    const itemData = {
      id: editingId ? editingId : Date.now().toString(),
      timestamp: finalTimestamp,
      category: selectedCategory,
      name: expenseName,
      amount: Number(expenseAmount.replace(/,/g, '')),
      store: storeName.trim(),
      payment: paymentMethod.trim(),
      icon: CATEGORY_ICONS[selectedCategory] || '💳'
    };

    let newData;
    if (editingId) {
      newData = expenseList.map(item => item.id === editingId ? itemData : item);
    } else {
      newData = [itemData, ...expenseList];
    }

    newData.sort((a, b) => b.timestamp - a.timestamp);
    setExpenseList(newData);
    setCurrentMonth(new Date(finalTimestamp));
    hapticSuccess();
    setCurrentView('list');
  };

  const deleteItem = (id) => {
    showDialog({
      title: '삭제', message: '이 지출 기록을 삭제하시겠습니까?',
      icon: 'trash-outline', iconColor: COLORS.negative, iconBg: hexToRgba(COLORS.negative, 0.12),
      actions: [
        {
          label: '삭제', style: 'destructive', onPress: () => {
            hapticWarning();
            setExpenseList(prev => prev.filter(item => item.id !== id));
          }
        },
        { label: '취소', style: 'cancel' },
      ],
    });
  };

  const onFabPressIn = () => { hapticLight(); Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 6 }).start(); };
  const onFabPressOut = () => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  /* ================= 렌더링 ================= */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.bgHeader} barStyle="light-content" />

      <AppModal
        visible={dialog.visible}
        icon={dialog.icon}
        iconColor={dialog.iconColor}
        iconBg={dialog.iconBg}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onRequestClose={closeDialog}
      />

      {currentView === 'settings' && (
        <View style={styles.flex1}>
          <LinearGradient colors={[COLORS.bgHeader, COLORS.bgHeaderDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerSimple}>
            <TouchableOpacity style={styles.headerBackBtn} onPress={() => setCurrentView('list')} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
              <Text style={styles.headerSimpleBtnText}>홈</Text>
            </TouchableOpacity>
            <Text style={styles.headerSimpleTitle}>설정</Text>
            <View style={{ width: 56 }} />
          </LinearGradient>
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsDesc}>데이터를 안전하게 보관하거나 다른 기기로 이동하려면 파일로 내보내고 불러올 수 있습니다.</Text>

            <TouchableOpacity style={styles.settingCard} activeOpacity={0.8} onPress={exportData}>
              <View style={[styles.settingCardIconWrap, { backgroundColor: COLORS.forestSoft }]}>
                <Ionicons name="cloud-upload-outline" size={22} color={COLORS.forest} />
              </View>
              <View style={styles.settingCardTextWrap}>
                <Text style={styles.settingCardTitle}>데이터 백업</Text>
                <Text style={styles.settingCardSubtitle}>기기 또는 파일로 내보내기</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.inkFaint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingCard} activeOpacity={0.8} onPress={importData}>
              <View style={[styles.settingCardIconWrap, { backgroundColor: COLORS.goldSoft }]}>
                <Ionicons name="cloud-download-outline" size={22} color={COLORS.gold} />
              </View>
              <View style={styles.settingCardTextWrap}>
                <Text style={styles.settingCardTitle}>데이터 복원</Text>
                <Text style={styles.settingCardSubtitle}>백업 파일 불러오기</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.inkFaint} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentView === 'input' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.flex1}>
              <LinearGradient colors={[COLORS.bgHeader, COLORS.bgHeaderDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerSimple}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={() => setCurrentView('list')} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={COLORS.white} />
                  <Text style={styles.headerSimpleBtnText}>취소</Text>
                </TouchableOpacity>
                <Text style={styles.headerSimpleTitle}>{editingId ? '지출 수정' : '지출 입력'}</Text>
                <View style={{ width: 56 }} />
              </LinearGradient>

              <View style={styles.formContainer}>

                {/* 1. 날짜 */}
                <Text style={styles.label}>날짜</Text>
                <View style={styles.dateSelectorRow}>
                  <TouchableOpacity onPress={() => changeInputDate(-1)} style={styles.dateArrowBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={18} color={COLORS.forest} />
                  </TouchableOpacity>
                  <Text style={styles.dateSelectedText}>{getDayString(inputDate.getTime())}</Text>
                  <TouchableOpacity onPress={() => changeInputDate(1)} style={styles.dateArrowBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.forest} />
                  </TouchableOpacity>
                </View>

                {/* 2. 분류 — 카테고리별 고유 색으로 구분 */}
                <Text style={styles.label}>분류</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const catColor = CATEGORY_COLORS[cat];
                    const active = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryBtn,
                          {
                            backgroundColor: active ? catColor : hexToRgba(catColor, 0.10),
                            borderColor: active ? catColor : hexToRgba(catColor, 0.35),
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={styles.categoryBtnIcon}>{CATEGORY_ICONS[cat]}</Text>
                        <Text style={[styles.categoryBtnText, { color: active ? COLORS.white : COLORS.ink }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 3. 소비 이름 */}
                <Text style={styles.label}>소비 이름 (필수)</Text>
                <TextInput
                  style={[styles.textInput, focusedField === 'name' && styles.textInputFocused]}
                  placeholder="ex) 점심 식사, 커피, 버스"
                  placeholderTextColor={COLORS.inkFaint}
                  value={expenseName}
                  onChangeText={setExpenseName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="next"
                />

                {/* 4. 구매처 및 결제수단 */}
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>구매처 (선택)</Text>
                    <TextInput
                      style={[styles.textInput, focusedField === 'store' && styles.textInputFocused]}
                      placeholder="ex) GS25"
                      placeholderTextColor={COLORS.inkFaint}
                      value={storeName}
                      onChangeText={setStoreName}
                      onFocus={() => setFocusedField('store')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>결제수단 (선택)</Text>
                    <TextInput
                      style={[styles.textInput, focusedField === 'payment' && styles.textInputFocused]}
                      placeholder="ex) 네이버페이"
                      placeholderTextColor={COLORS.inkFaint}
                      value={paymentMethod}
                      onChangeText={setPaymentMethod}
                      onFocus={() => setFocusedField('payment')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* 5. 금액 */}
                <Text style={styles.label}>금액 (필수)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={COLORS.inkFaint}
                    value={expenseAmount}
                    onChangeText={setExpenseAmount}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={saveExpense}
                  />
                  <Text style={styles.amountCurrency}>원</Text>
                </View>

                {/* 6. 저장 버튼 */}
                <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={saveExpense}>
                  <Text style={styles.saveBtnText}>{editingId ? '수정 완료' : '저장'}</Text>
                </TouchableOpacity>

              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {currentView === 'list' && (
        <View style={styles.flex1}>
          <LinearGradient colors={[COLORS.bgHeader, COLORS.bgHeaderDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerList}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.eyebrow}>MY LEDGER</Text>
                <View style={styles.monthRow}>
                  <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrowBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>{getYearMonthString(currentMonth)}</Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrowBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.settingsBtn} activeOpacity={0.7} onPress={() => setCurrentView('settings')}>
                <Ionicons name="settings-outline" size={19} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>이번 달 총 지출</Text>
            <Text style={styles.summaryAmount}>{totalMonthExpense.toLocaleString()}원</Text>

            {categoryBreakdown.length > 0 && (
              <>
                <View style={styles.breakdownBarTrack}>
                  {categoryBreakdown.map(c => (
                    <View
                      key={c.category}
                      style={[styles.breakdownSegment, { flex: c.percent > 0 ? c.percent : 0.001, backgroundColor: c.color }]}
                    />
                  ))}
                </View>
                <View style={styles.breakdownLegendRow}>
                  {categoryBreakdown.slice(0, 3).map(c => (
                    <View key={c.category} style={styles.breakdownLegendItem}>
                      <View style={[styles.breakdownDot, { backgroundColor: c.color }]} />
                      <Text style={styles.breakdownLegendText}>{c.category}</Text>
                      <Text style={styles.breakdownLegendAmount}>{c.amount.toLocaleString()}원</Text>
                    </View>
                  ))}
                  {categoryBreakdown.length > 3 && (
                    <Text style={styles.breakdownMoreText}>+{categoryBreakdown.length - 3}개 카테고리</Text>
                  )}
                </View>
              </>
            )}
          </View>

          {groupedData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={30} color={COLORS.forest} />
              </View>
              <Text style={styles.emptyText}>입력된 지출이 없습니다.</Text>
              <Text style={styles.emptySubText}>우측 하단의 + 버튼을 눌러 기록해보세요.</Text>
            </View>
          ) : (
            <SectionList
              sections={groupedData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderSectionHeader={({ section }) => {
                const dayTotal = section.data.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
                return (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                    <Text style={styles.sectionHeaderTotal}>{dayTotal.toLocaleString()}원</Text>
                  </View>
                );
              }}
              renderItem={({ item }) => {
                const catColor = CATEGORY_COLORS[item.category] || COLORS.inkFaint;
                return (
                  <View style={styles.expenseItem}>
                    <View style={[styles.expenseIconContainer, { backgroundColor: hexToRgba(catColor, 0.15) }]}>
                      <Text style={styles.expenseIcon}>{item.icon}</Text>
                    </View>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.detailsRow}>
                        <View style={[styles.categoryBadge, { backgroundColor: hexToRgba(catColor, 0.14) }]}>
                          <Text style={[styles.categoryBadgeText, { color: catColor }]}>{item.category}</Text>
                        </View>
                        {item.store ? <Text style={styles.detailText}>· {item.store}</Text> : null}
                        {item.payment ? <Text style={styles.detailText}>· {item.payment}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.expenseCost}>-{item.amount.toLocaleString()}원</Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => editItem(item)}>
                          <Ionicons name="create-outline" size={16} color={COLORS.inkSoft} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => deleteItem(item.id)}>
                          <Ionicons name="close" size={17} color="#B98A8E" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <Animated.View style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
            <TouchableOpacity
              style={styles.fabTouchable}
              activeOpacity={0.9}
              onPress={openInputView}
              onPressIn={onFabPressIn}
              onPressOut={onFabPressOut}
            >
              <LinearGradient colors={[COLORS.forest, COLORS.forestDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
                <Ionicons name="add" size={28} color={COLORS.gold} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  flex1: { flex: 1 },

  // ---- 리스트 화면 헤더 ----
  headerList: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: COLORS.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthArrowBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  monthTitle: { color: COLORS.white, fontSize: 24, fontWeight: '800', letterSpacing: 0.3, minWidth: 92, textAlign: 'center' },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },

  // ---- 단순 헤더 (설정 / 입력 화면 공통) ----
  headerSimple: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerBackBtn: { flexDirection: 'row', alignItems: 'center', width: 56 },
  headerSimpleBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginLeft: 2 },
  headerSimpleTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

  // ---- 요약 카드 (헤더 위로 살짝 겹치는 원장 카드) ----
  summaryCard: {
    marginHorizontal: 20, marginTop: -22, backgroundColor: COLORS.card, borderRadius: 20, padding: 20,
    ...cardShadow,
  },
  summaryTitle: { fontSize: 13, color: COLORS.inkSoft, fontWeight: '600', marginBottom: 6 },
  summaryAmount: { fontFamily: MONO_FONT, fontSize: 30, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.3 },
  breakdownBarTrack: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', backgroundColor: COLORS.fieldBg, marginTop: 16 },
  breakdownSegment: { height: '100%' },
  breakdownLegendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12 },
  breakdownLegendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 },
  breakdownDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  breakdownLegendText: { fontSize: 12, color: COLORS.ink, fontWeight: '700', marginRight: 4 },
  breakdownLegendAmount: { fontSize: 12, color: COLORS.inkSoft, fontFamily: MONO_FONT },
  breakdownMoreText: { fontSize: 12, color: COLORS.inkFaint, marginBottom: 4 },

  // ---- 설정 화면 ----
  settingsContainer: { padding: 20, paddingTop: 24 },
  settingsDesc: { fontSize: 14, color: COLORS.inkSoft, marginBottom: 24, lineHeight: 21 },
  settingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, ...cardShadow },
  settingCardIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingCardTextWrap: { flex: 1 },
  settingCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 2 },
  settingCardSubtitle: { fontSize: 12, color: COLORS.inkSoft },

  // ---- 빈 목록 ----
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.forestSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyText: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20 },

  // ---- 날짜별 섹션 헤더 (일별 소계 포함) ----
  listContent: { paddingBottom: 110, paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EEF1EC', paddingHorizontal: 20, paddingVertical: 8,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.divider,
  },
  sectionHeaderTitle: { fontSize: 12, fontWeight: '700', color: COLORS.inkSoft, letterSpacing: 0.3 },
  sectionHeaderTotal: { fontSize: 12, fontWeight: '700', color: COLORS.inkFaint, fontFamily: MONO_FONT },

  // ---- 지출 항목 ----
  expenseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  expenseIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  expenseIcon: { fontSize: 17 },
  expenseInfo: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  expenseName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  categoryBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, marginRight: 6, marginBottom: 2 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  detailText: { fontSize: 12, color: COLORS.inkFaint, marginRight: 6 },
  itemRight: { alignItems: 'flex-end' },
  expenseCost: { fontSize: 15, fontWeight: '800', color: COLORS.negative, fontFamily: MONO_FONT, marginBottom: 4 },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingVertical: 4, paddingHorizontal: 6 },

  // ---- 플로팅 액션 버튼 ----
  fabWrap: { position: 'absolute', bottom: 22, right: 20 },
  fabTouchable: {
    width: 60, height: 60, borderRadius: 30,
    shadowColor: COLORS.forest, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  fabGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

  // ---- 입력 폼 ----
  formContainer: { paddingHorizontal: 20, backgroundColor: COLORS.bg, flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.inkSoft, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.4 },
  dateSelectorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.fieldBg, borderWidth: 1.5, borderColor: COLORS.divider, borderRadius: 14, padding: 4,
  },
  dateArrowBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.forestSoft, justifyContent: 'center', alignItems: 'center' },
  dateSelectedText: { fontSize: 15, color: COLORS.ink, fontWeight: '700' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryBtn: { width: '23%', paddingVertical: 10, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryBtnIcon: { fontSize: 17, marginBottom: 4 },
  categoryBtnText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  textInput: { borderWidth: 1.5, borderColor: COLORS.divider, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.fieldBg },
  textInputFocused: { borderColor: COLORS.forest, backgroundColor: COLORS.white },

  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 1, marginHorizontal: 2 },

  amountInputContainer: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: COLORS.gold, paddingBottom: 8, marginTop: 4 },
  amountInput: { flex: 1, textAlign: 'right', paddingRight: 10, color: COLORS.negative, fontWeight: '800', fontSize: 26, fontFamily: MONO_FONT },
  amountCurrency: { fontSize: 16, fontWeight: '700', marginLeft: 8, color: COLORS.ink },

  saveBtn: { backgroundColor: COLORS.forest, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24, ...cardShadow },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  // ---- 커스텀 다이얼로그 (Alert 대체) ----
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,20,15,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 20, padding: 22, ...cardShadow },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: COLORS.inkSoft, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  modalActions: { width: '100%' },
  modalBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  modalBtnPrimary: { backgroundColor: COLORS.forest },
  modalBtnDestructive: { backgroundColor: COLORS.negative },
  modalBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white, letterSpacing: 0.2 },
  modalCancelBtn: { paddingVertical: 6, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.inkSoft },
});
