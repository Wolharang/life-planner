import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, SectionList, 
  SafeAreaView, Alert, BackHandler, StatusBar, 
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  Image, Modal 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import ImageViewer from 'react-native-image-zoom-viewer'; 

const DAY_OF_WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const CATEGORIES = ['아침', '점심', '저녁', '간식'];

const KCAL_TARGETS = {
  '아침': 400,
  '점심': 500,
  '저녁': 400,
  '간식': 200
};

export default function App() {
  const [currentView, setCurrentView] = useState('list');
  const [dietList, setDietList] = useState([]);
  
  const [selectedCategory, setSelectedCategory] = useState('아침');
  const [itemName, setItemName] = useState(''); 
  const [itemDetails, setItemDetails] = useState(''); 
  const [itemKcal, setItemKcal] = useState(''); 
  const [itemImage, setItemImage] = useState(null); 
  const [editingId, setEditingId] = useState(null); 
  
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [viewImageUri, setViewImageUri] = useState(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inputDate, setInputDate] = useState(new Date());
  
  const [isLoaded, setIsLoaded] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const backAction = () => {
      if (currentView !== 'list') {
        setCurrentView('list');
        return true; 
      }
      return false; 
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentView]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('@diet_list');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          parsedData.sort((a, b) => b.timestamp - a.timestamp);
          setDietList(parsedData);
        }
      } catch (error) {
        console.error('데이터 불러오기 실패:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('@diet_list', JSON.stringify(dietList));
        } catch (error) {
          console.error('데이터 저장 실패:', error);
        }
      };
      saveData();
    }
  }, [dietList, isLoaded]);

  /* ================= 백업 및 복원 로직 ================= */
  const exportData = async () => {
    try {
      if (dietList.length === 0) {
        Alert.alert('알림', '백업할 데이터가 없습니다.');
        return;
      }
      const jsonData = JSON.stringify(dietList);
      const fileName = `diet_backup_${Date.now()}.json`;

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri, fileName, 'application/json'
            );
            await FileSystem.writeAsStringAsync(targetUri, jsonData, { encoding: FileSystem.EncodingType.UTF8 });
            Alert.alert('완료', '선택하신 기기 폴더에 백업 파일이 안전하게 저장되었습니다.');
            return; 
          } else {
            Alert.alert('취소', '저장할 폴더가 선택되지 않았습니다.');
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
        await Sharing.shareAsync(fileUri, { UTI: 'public.json', mimeType: 'application/json', dialogTitle: '식단 백업' });
      }
    } catch (error) {
      Alert.alert('오류', `데이터 백업 중 예상치 못한 문제가 발생했습니다.\n${error.message}`);
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContents = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
        let parsedData;
        try { parsedData = JSON.parse(fileContents); } catch (e) {
          Alert.alert('오류', '유효한 백업(JSON) 파일이 아닙니다.'); return;
        }
        if (Array.isArray(parsedData) && parsedData.every(item => item.id && item.timestamp && item.name)) {
          Alert.alert('데이터 복원', '어떻게 적용하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            { 
              text: '기존 데이터와 병합', onPress: () => {
                const mergedData = [...dietList];
                parsedData.forEach(newItem => {
                  if (!mergedData.some(existingItem => existingItem.id === newItem.id)) mergedData.push(newItem);
                });
                mergedData.sort((a, b) => b.timestamp - a.timestamp);
                setDietList(mergedData);
                Alert.alert('완료', '데이터가 성공적으로 병합되었습니다.');
              }
            },
            { 
              text: '기존 데이터 덮어쓰기', style: 'destructive', onPress: () => {
                parsedData.sort((a, b) => b.timestamp - a.timestamp);
                setDietList(parsedData);
                Alert.alert('완료', '데이터가 덮어씌워졌습니다.');
              }
            }
          ]);
        } else {
          Alert.alert('오류', '데이터가 손상되었습니다.');
        }
      }
    } catch (error) {
      Alert.alert('오류', '파일을 읽어오는 중 문제가 발생했습니다.');
    }
  };

  /* ================= 포맷팅 및 요약 계산 ================= */
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

  const filteredList = dietList.filter(item => {
    const itemDate = new Date(item.timestamp);
    return itemDate.getFullYear() === currentMonth.getFullYear() && itemDate.getMonth() === currentMonth.getMonth();
  });

  const groupedData = filteredList.reduce((acc, item) => {
    const dateTitle = getDayString(item.timestamp);
    const existingSection = acc.find(section => section.title === dateTitle);
    if (existingSection) existingSection.data.push(item);
    else acc.push({ title: dateTitle, data: [item] });
    return acc;
  }, []);

  const today = new Date();
  const todaysItems = dietList.filter(item => {
    const d = new Date(item.timestamp);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });
  
  const totalTodayKcal = todaysItems.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
  
  const getDietSummaryLine = (cat) => {
    const items = todaysItems.filter(i => i.category === cat);
    const currentSum = items.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
    const target = KCAL_TARGETS[cat];
    if (items.length === 0) return `[0/${target}]: `;
    const foodListString = items.map(i => i.name).join(', ');
    return `[${currentSum}/${target}]: ${foodListString}`;
  };

  const isExerciseDoneToday = todaysItems.some(item => item.category === '운동');
  const isRunningDoneToday = todaysItems.some(item => item.category === '러닝');

  /* ================= 갤러리 접근 ================= */
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
    });
    if (!result.canceled) {
      setItemImage(result.assets[0].uri);
    }
  };

  /* ================= 데이터 조작 ================= */
  const openInputView = () => {
    setEditingId(null);
    setInputDate(new Date());
    setItemName(''); 
    setItemDetails('');
    setItemKcal('');
    setItemImage(null); 
    setSelectedCategory('아침');
    setCurrentView('input');
  };

  const editItem = (item) => {
    setEditingId(item.id); 
    setInputDate(new Date(item.timestamp));
    setItemName(item.name);
    setItemDetails(item.details || '');
    setItemKcal(item.kcal ? item.kcal.toString() : ''); 
    setItemImage(item.image || null);
    setSelectedCategory(item.category);
    setCurrentView('input');
  };

  const saveDiet = () => {
    if (!itemName.trim()) {
      Alert.alert('알림', '기록할 음식 이름을 입력해주세요.');
      return;
    }
    const icons = { '아침': '🍳', '점심': '🍱', '저녁': '🥩', '간식': '☕' };
    const now = new Date();
    const finalTimestamp = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
    
    const itemData = {
      id: editingId ? editingId : Date.now().toString(), 
      timestamp: finalTimestamp, 
      category: selectedCategory, 
      name: itemName.trim(), 
      details: itemDetails.trim(),
      kcal: itemKcal.trim() ? Number(itemKcal) : 0, 
      image: itemImage, 
      icon: icons[selectedCategory] || '🍽️'
    };

    let newData;
    if (editingId) {
      newData = dietList.map(item => item.id === editingId ? itemData : item);
    } else {
      newData = [itemData, ...dietList];
    }
    newData.sort((a, b) => b.timestamp - a.timestamp);
    setDietList(newData);
    setCurrentMonth(new Date(finalTimestamp));
    setCurrentView('list');
  };

  const addPhysicalActivity = (type) => {
    Alert.alert(
      `${type} 추가`,
      `${type}을(를) 추가하시겠습니까?\n이 결정은 되돌릴 수 없습니다.`,
      [
        { text: '아니오', style: 'cancel' },
        { 
          text: '예', 
          onPress: () => {
            const now = new Date();
            const finalTimestamp = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
            
            const activityItem = {
              id: Date.now().toString(), 
              timestamp: finalTimestamp, 
              category: type, 
              name: `${type} 완료`, 
              details: '',
              kcal: 0,
              image: null,
              icon: type === '러닝' ? '👟' : '🏃‍♂️'
            };

            const newData = [activityItem, ...dietList];
            newData.sort((a, b) => b.timestamp - a.timestamp);
            setDietList(newData);
            setCurrentMonth(new Date(finalTimestamp));
            setCurrentView('list');
          } 
        }
      ]
    );
  };

  const deleteItem = (id) => {
    Alert.alert('삭제', '이 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setDietList(prev => prev.filter(item => item.id !== id)) }
    ]);
  };

  /* ================= 렌더링 ================= */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />

      <Modal visible={imageModalVisible} transparent={true} onRequestClose={() => setImageModalVisible(false)}>
        {viewImageUri && (
          <ImageViewer 
            imageUrls={[{ url: viewImageUri }]} 
            enableSwipeDown={true}
            onSwipeDown={() => setImageModalVisible(false)}
            renderHeader={() => (
              <SafeAreaView>
                <TouchableOpacity 
                  style={styles.modalCloseIconBtn} 
                  onPress={() => setImageModalVisible(false)}
                  accessibilityLabel="사진 닫기"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCloseIconText}>✕</Text>
                </TouchableOpacity>
              </SafeAreaView>
            )}
          />
        )}
      </Modal>

      {/* 설정 화면 */}
      {currentView === 'settings' && (
        <View style={styles.flex1}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentView('list')} accessibilityLabel="홈으로 이동" accessibilityRole="button">
              <Text style={styles.headerBtnText}>홈</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>설정</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsDesc}>데이터를 안전하게 보관하거나 다른 기기로 이동하려면 파일로 내보내고 불러올 수 있습니다.</Text>
            <TouchableOpacity style={styles.settingButton} onPress={exportData} accessibilityLabel="데이터 백업 내보내기" accessibilityRole="button">
              <Text style={styles.settingButtonText}>📥 데이터 백업 (내보내기)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingButton, styles.importButton]} onPress={importData} accessibilityLabel="데이터 복원 불러오기" accessibilityRole="button">
              <Text style={[styles.settingButtonText, styles.importButtonText]}>📤 데이터 복원 (불러오기)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 입력 화면 */}
      {currentView === 'input' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.flex1}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setCurrentView('list')} accessibilityLabel="입력 취소" accessibilityRole="button">
                  <Text style={styles.headerBtnText}>취소</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{editingId ? '기록 수정' : '기록 추가'}</Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={styles.formContainer}>
                <Text style={styles.label}>날짜</Text>
                <View style={styles.dateSelectorRow}>
                  <TouchableOpacity onPress={() => changeInputDate(-1)} style={styles.dateArrowBtn} accessibilityLabel="이전 날짜로 이동" accessibilityRole="button">
                    <Text style={styles.dateArrowText}>{'<'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateSelectedText} accessibilityLabel={`선택된 날짜: ${getDayString(inputDate.getTime())}`}>
                    {getDayString(inputDate.getTime())}
                  </Text>
                  <TouchableOpacity onPress={() => changeInputDate(1)} style={styles.dateArrowBtn} accessibilityLabel="다음 날짜로 이동" accessibilityRole="button">
                    <Text style={styles.dateArrowText}>{'>'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>음식 분류</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity 
                      key={cat} 
                      style={[styles.categoryBtn, selectedCategory === cat && styles.categoryBtnActive]} 
                      onPress={() => setSelectedCategory(cat)}
                      accessibilityLabel={`${cat} 분류 선택`}
                      accessibilityState={{ selected: selectedCategory === cat }}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.categoryBtnText, selectedCategory === cat && styles.categoryBtnTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>음식 이름 (필수)</Text>
                    <TextInput 
                      style={styles.textInput} 
                      placeholder="ex) 연어 포케" 
                      value={itemName} 
                      onChangeText={setItemName} 
                      returnKeyType="next" 
                      accessibilityLabel="음식 이름 입력"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>상세 정보 (선택)</Text>
                    <TextInput 
                      style={styles.textInput} 
                      placeholder="ex) 식당, 소스 종류" 
                      value={itemDetails} 
                      onChangeText={setItemDetails} 
                      returnKeyType="next" 
                      accessibilityLabel="상세 정보 입력"
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>칼로리 (kcal)</Text>
                    <View style={styles.kcalInputContainer}>
                      <TextInput 
                        style={[styles.textInput, styles.kcalInput]} 
                        placeholder="0" 
                        value={itemKcal} 
                        onChangeText={setItemKcal} 
                        keyboardType="numeric" 
                        returnKeyType="done" 
                        accessibilityLabel="칼로리 입력"
                      />
                      <Text style={styles.kcalCurrency}>kcal</Text>
                    </View>
                  </View>
                  
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>사진 첨부 (선택)</Text>
                    <View style={styles.photoUploadRow}>
                      <TouchableOpacity style={styles.photoBtn} onPress={pickImage} accessibilityLabel="사진 첨부하기" accessibilityRole="button">
                        <Text style={styles.photoBtnTextUI}>{itemImage ? '사진 변경' : '📷 선택'}</Text>
                      </TouchableOpacity>
                      {itemImage && (
                        <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setItemImage(null)} accessibilityLabel="첨부된 사진 삭제" accessibilityRole="button">
                          <Text style={styles.photoRemoveBtnText}>삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={saveDiet} accessibilityLabel="식단 저장" accessibilityRole="button">
                  <Text style={styles.saveBtnText}>{editingId ? '기록 수정 완료' : '음식 기록 저장'}</Text>
                </TouchableOpacity>

                {!editingId && (
                  <View style={styles.exerciseSection}>
                    <View style={styles.divider} />
                    <Text style={styles.exerciseHeader}>또는 신체 활동</Text>
                    <View style={styles.activityBtnRow}>
                      <TouchableOpacity style={[styles.exerciseBtn, { backgroundColor: '#0288D1', marginRight: 6 }]} onPress={() => addPhysicalActivity('러닝')} accessibilityLabel="러닝 활동 추가" accessibilityRole="button">
                        <Text style={styles.exerciseBtnText}>👟 러닝 완료</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.exerciseBtn, { marginLeft: 6 }]} onPress={() => addPhysicalActivity('운동')} accessibilityLabel="운동 활동 추가" accessibilityRole="button">
                        <Text style={styles.exerciseBtnText}>🏃‍♂️ 운동 완료</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* 리스트 화면 */}
      {currentView === 'list' && (
        <View style={styles.flex1}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setCurrentView('settings')} accessibilityLabel="설정 메뉴" accessibilityRole="button">
              <Text style={styles.headerIconText}>⚙️</Text>
            </TouchableOpacity>
            <View style={styles.monthControl}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} accessibilityLabel="이전 달로 이동" accessibilityRole="button">
                <Text style={styles.headerBtnText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle} accessibilityLabel={`현재 월: ${getYearMonthString(currentMonth)}`}>
                {getYearMonthString(currentMonth)}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} accessibilityLabel="다음 달로 이동" accessibilityRole="button">
                <Text style={styles.headerBtnText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.summaryPanel}>
            <View style={styles.summaryHeaderCol}>
              <Text style={styles.summaryTitle} accessibilityRole="header">오늘의 기록 요약 ({String(today.getDate()).padStart(2, '0')}일)</Text>
              <Text style={styles.targetKcalText}>( 현재 {totalTodayKcal}kcal / 목표 1500kcal )</Text>
            </View>
            <View style={styles.summaryList}>
              <Text style={[styles.summaryText, { color: '#0288D1', fontWeight: 'bold' }]} numberOfLines={1}>👟 러닝: {isRunningDoneToday ? 'O (완료)' : 'X'}</Text>
              <Text style={styles.summaryText} numberOfLines={1}>🍳 아침 {getDietSummaryLine('아침')}</Text>
              <Text style={styles.summaryText} numberOfLines={1}>🍱 점심 {getDietSummaryLine('점심')}</Text>
              <Text style={styles.summaryText} numberOfLines={1}>🥩 저녁 {getDietSummaryLine('저녁')}</Text>
              <Text style={styles.summaryText} numberOfLines={1}>☕ 간식 {getDietSummaryLine('간식')}</Text>
              <Text style={[styles.summaryText, { color: '#FF5722', fontWeight: 'bold' }]} numberOfLines={1}>🏃 운동: {isExerciseDoneToday ? 'O (완료)' : 'X'}</Text>
            </View>
          </View>

          {groupedData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>입력된 기록이 없습니다.</Text>
              <Text style={styles.emptySubText}>우측 하단의 + 버튼을 눌러 추가해보세요.</Text>
            </View>
          ) : (
            <SectionList
              sections={groupedData}
              keyExtractor={(item) => item.id}
              renderSectionHeader={({ section: { title } }) => <Text style={styles.dateLabel} accessibilityRole="header">{title}</Text>}
              renderItem={({ item }) => {
                
                if (item.category === '운동' || item.category === '러닝') {
                  const isRunning = item.category === '러닝';
                  return (
                    <View style={styles.foodItem}>
                      <View style={[styles.foodIconContainer, isRunning && {backgroundColor: '#E1F5FE'}]}>
                        <Text style={styles.foodIcon}>{item.icon}</Text>
                      </View>
                      <View style={styles.foodInfo}>
                        <Text style={[styles.exerciseBigText, isRunning && {color: '#0288D1'}]}>{item.name}</Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => deleteItem(item.id)} accessibilityLabel={`${item.name} 삭제`} accessibilityRole="button">
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                return (
                  <View style={styles.foodItem}>
                    <View style={styles.foodIconContainer}><Text style={styles.foodIcon}>{item.icon}</Text></View>
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.detailsRow}>
                        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{item.category}</Text></View>
                        {item.kcal ? <View style={styles.kcalBadge}><Text style={styles.kcalBadgeText}>{item.kcal}kcal</Text></View> : null}
                        {item.details ? <Text style={styles.detailText}>• {item.details}</Text> : null}
                      </View>
                    </View>
                    
                    <View style={styles.actionButtons}>
                      {item.image && (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => { setViewImageUri(item.image); setImageModalVisible(true); }} accessibilityLabel={`${item.name} 사진 보기`} accessibilityRole="button">
                          <Text style={styles.viewPhotoIcon}>🖼️</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.iconBtn} onPress={() => editItem(item)} accessibilityLabel={`${item.name} 수정`} accessibilityRole="button">
                        <Text style={styles.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => deleteItem(item.id)} accessibilityLabel={`${item.name} 삭제`} accessibilityRole="button">
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.fab} onPress={openInputView} accessibilityLabel="새 기록 추가" accessibilityRole="button">
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4CAF50', padding: 15, height: 60 },
  monthControl: { flexDirection: 'row', alignItems: 'center' },
  monthArrow: { paddingHorizontal: 15 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerIconBtn: { width: 40, justifyContent: 'center' },
  headerIconText: { fontSize: 22 },
  
  summaryPanel: { backgroundColor: '#ffffff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginBottom: 5 },
  summaryHeaderCol: { alignItems: 'center', marginBottom: 12 },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  targetKcalText: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  summaryList: { flexDirection: 'column', gap: 4 },
  summaryText: { fontSize: 13, color: '#444', fontWeight: '500' },

  settingsContainer: { padding: 20 },
  settingsDesc: { fontSize: 15, color: '#555', marginBottom: 30, lineHeight: 22 },
  settingButton: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 10, alignItems: 'center', marginBottom: 15, elevation: 3 },
  settingButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  importButton: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#4CAF50' },
  importButtonText: { color: '#4CAF50' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#555', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#999' },
  dateLabel: { fontSize: 13, color: '#444', fontWeight: 'bold', backgroundColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1' },
  
  foodItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  foodIconContainer: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff3e0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  foodIcon: { fontSize: 16 },
  foodInfo: { flex: 1, justifyContent: 'center' },
  foodName: { fontSize: 15, color: '#333', marginBottom: 3 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  categoryBadge: { backgroundColor: '#f1f3f5', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  categoryBadgeText: { fontSize: 11, color: '#666' },
  kcalBadge: { backgroundColor: '#E8F5E9', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  kcalBadgeText: { fontSize: 11, color: '#2E7D32', fontWeight: 'bold' },
  detailText: { fontSize: 12, color: '#888' }, 
  exerciseBigText: { fontSize: 17, fontWeight: 'bold', color: '#FF5722' },

  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingVertical: 5, paddingHorizontal: 6 },
  viewPhotoIcon: { fontSize: 17 },
  editBtnText: { fontSize: 15 },
  deleteBtnText: { color: '#bbb', fontSize: 18, fontWeight: 'bold' },
  
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, backgroundColor: '#FF5722', borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: 'white', fontSize: 30, fontWeight: 'bold' },
  
  formContainer: { paddingHorizontal: 20, backgroundColor: 'white', flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5, marginTop: 12 },
  dateSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 2 },
  dateArrowBtn: { padding: 10, paddingHorizontal: 20 },
  dateArrowText: { fontSize: 18, color: '#555', fontWeight: 'bold' },
  dateSelectedText: { fontSize: 15, color: '#333', fontWeight: 'bold' },
  
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryBtn: { width: '23%', paddingVertical: 8, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, alignItems: 'center', marginBottom: 6, backgroundColor: '#fafafa' },
  categoryBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  categoryBtnText: { color: '#666', fontSize: 12 },
  categoryBtnTextActive: { color: 'white', fontWeight: 'bold' },
  
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 1, marginHorizontal: 2 },
  textInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  
  kcalInputContainer: { flexDirection: 'row', alignItems: 'center' },
  kcalInput: { flex: 1, textAlign: 'right', paddingRight: 10, color: '#2E7D32', fontWeight: 'bold', fontSize: 16 },
  kcalCurrency: { fontSize: 15, fontWeight: 'bold', marginLeft: 8, color: '#333' },

  photoUploadRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  photoBtn: { flex: 1, backgroundColor: '#e2e8f0', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 5 },
  photoBtnTextUI: { color: '#444', fontSize: 14, fontWeight: '600' },
  photoRemoveBtn: { padding: 10, backgroundColor: '#ffcdd2', borderRadius: 8 },
  photoRemoveBtnText: { color: '#d32f2f', fontSize: 12, fontWeight: 'bold' },

  saveBtn: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  exerciseSection: { marginTop: 20, alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#eee', width: '100%', position: 'absolute', top: 10 },
  exerciseHeader: { backgroundColor: 'white', paddingHorizontal: 10, color: '#999', fontSize: 13, marginBottom: 12 },
  activityBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  exerciseBtn: { flex: 1, backgroundColor: '#FF5722', padding: 12, borderRadius: 8, alignItems: 'center', elevation: 2 },
  exerciseBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },

  modalCloseIconBtn: { padding: 20, alignItems: 'flex-end' },
  modalCloseIconText: { color: 'white', fontSize: 30, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }
});