/**
 * B2B Tour Package Builder Backend API
 * File: gas-tour-builder.gs
 * Deskripsi: API Integrasi Google Sheets untuk JAKALELANA Tour & Travel
 */

const SPREADSHEET_ID = '1kcgF8TNENXYERw7pMr1qVdL-ig-nezSGlrupDyh3G3Q';

// Format respon standar JSON
function createResponse(success, data = null, message = '') {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    data: data,
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getVendors') {
      const category = e.parameter.category;
      const role = e.parameter.role;
      const username = e.parameter.username;
      
      return createResponse(true, getVendorsData(category, role, username), 'Data mitra berhasil diambil');
    } else if (action === 'getPackages') {
      return createResponse(true, getPackagesData(), 'Data paket berhasil diambil');
    } else if (action === 'getLogs') {
      return createResponse(true, getLogsData(), 'Data log berhasil diambil');
    } else if (action === 'getPublicTicketsMeta') {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Vendors_Ticket');
      if (!sheet) return createResponse(true, [], 'Data kosong');
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return createResponse(true, [], 'Data kosong');
      const items = [];
      const headers = data[0];
      for(let i=1; i<data.length; i++) {
         let obj = {};
         for(let j=0; j<headers.length; j++) obj[headers[j]] = data[i][j];
         items.push({
             Name: obj.Name,
             Category: obj.Category,
             Description: obj.Description,
             Location: obj.Location,
             Price: obj.Price_Per_Pax,
             Update_Date: obj.Update_Date
         });
      }
      return createResponse(true, items, 'Metadata tiket berhasil diambil');
    }
    
    return createResponse(false, null, 'Aksi tidak valid');
  } catch (error) {
    return createResponse(false, null, error.toString());
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    let requestData;
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else {
      requestData = e.parameter;
    }
    
    const action = requestData.action;
    
    if (action === 'login') {
      const user = handleLogin(requestData.username, requestData.password);
      if (user) {
        return createResponse(true, user, 'Berhasil masuk');
      }
      return createResponse(false, null, 'Nama pengguna atau kata sandi salah');
    } else if (action === 'saveVendorData') {
      saveVendorData(requestData.category, requestData.data);
      return createResponse(true, null, 'Data layanan berhasil disimpan');
    } else if (action === 'deleteVendorData') {
      deleteVendorData(requestData.category, requestData.id, requestData.username);
      return createResponse(true, null, 'Data layanan berhasil dihapus');
    } else if (action === 'savePackage') {
      savePackage(requestData.data);
      return createResponse(true, null, 'Paket wisata berhasil disimpan');
    } else if (action === 'deletePackage') {
      deletePackage(requestData.id);
      return createResponse(true, null, 'Paket wisata berhasil dihapus');
    } else if (action === 'updateProfile') {
      const updatedUser = updateProfile(requestData.username, requestData.profileData);
      return createResponse(true, updatedUser, 'Profil berhasil diperbarui');
    }
    
    return createResponse(false, null, 'Aksi tidak valid');
  } catch (error) {
    return createResponse(false, null, error.toString());
  }
}

// ======================== LOGGING SYSTEM ========================
function appendLog(actor, action, detail) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Logs');
    if (!sheet) return;
    
    // Format Waktu: dd/MM/yyyy HH:mm:ss
    const now = new Date();
    const timeStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
    
    sheet.appendRow([timeStr, actor, action, detail]);
  } catch(e) {
    // Ignore error if log fails
  }
}

function getLogsData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Logs');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    items.push(obj);
  }
  
  // Return in descending order (newest first)
  return items.reverse();
}
// ================================================================

// Autentikasi Pengguna
function handleLogin(username, password) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  
  // Headers: Username, Password, Role, Kategori, Nama_Instansi, PIC, Nomor_Telepon, Alamat, Logo_URL
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == username && data[i][1] == password) {
      return {
        username: data[i][0],
        role: data[i][2],
        category: data[i][3],
        name: data[i][4],
        pic: data[i][5],
        phone: data[i][6],
        address: data[i][7],
        logo: data[i][8] || ''
      };
    }
  }
  return null;
}

// Update Profil & Logo
function updateProfile(username, profileData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
  if(!sheet) throw new Error('Sheet Users tidak ditemukan');
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  let userRow = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      rowIndex = i + 1;
      userRow = data[i];
      break;
    }
  }
  
  if (rowIndex === -1) throw new Error('Pengguna tidak ditemukan');
  
  let newLogoUrl = userRow[8] || '';
  
  // Jika ada file logo yang diupload
  if (profileData.logoBase64 && profileData.logoMimeType) {
    const folderId = '1TeyfNiWoC84Zc5hdjUyecuv5mCqJKJHt';
    const folder = DriveApp.getFolderById(folderId);
    
    // Hapus logo lama
    const files = folder.searchFiles("title contains 'LOGO_" + username + "_'");
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
    
    // Simpan logo baru
    const blob = Utilities.newBlob(Utilities.base64Decode(profileData.logoBase64.split(',')[1]), profileData.logoMimeType, 'LOGO_' + username + '_' + new Date().getTime() + '.' + profileData.logoExt);
    const newFile = folder.createFile(blob);
    
    // Gunakan URL langsung dari ID file untuk menghindari error permission 'setSharing'
    newLogoUrl = 'https://drive.google.com/uc?id=' + newFile.getId();
  }
  
  // Cegah Google Sheets menghilangkan angka '0' di depan pada nomor telepon
  let safePhone = profileData.phone || userRow[6];
  if (safePhone && safePhone.toString().startsWith('0')) {
      safePhone = "'" + safePhone;
  }

  // Update data ke sheet
  // Urutan: Username (0), Password (1), Role (2), Kategori (3), Nama_Instansi (4), PIC (5), Nomor_Telepon (6), Alamat (7), Logo_URL (8)
  const newName = profileData.name || userRow[4];
  const oldName = userRow[4];

  const updatedRow = [
    userRow[0], // username
    userRow[1], // password
    userRow[2], // role
    userRow[3], // category
    newName,
    profileData.pic || userRow[5],
    safePhone,
    profileData.address || userRow[7],
    newLogoUrl
  ];
  
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);

  // Jika nama instansi berubah, perbarui semua ID layanannya
  if (newName !== oldName) {
      cascadeVendorIdChanges(username, userRow[3], newName);
  }
  
  return {
    username: updatedRow[0],
    role: updatedRow[2],
    category: updatedRow[3],
    name: updatedRow[4],
    pic: updatedRow[5],
    phone: updatedRow[6],
    address: updatedRow[7],
    logo: updatedRow[8]
  };
}

// Fungsi Cascading Update ID
function cascadeVendorIdChanges(username, category, newName) {
    let sheetName = '';
    let catCode = 'X';
    let idColumnInPackage = '';
    
    if (category === 'transport') { sheetName = 'Vendors_Transport'; catCode = 'T'; idColumnInPackage = 'Transport_ID'; }
    else if (category === 'hotel') { sheetName = 'Vendors_Hotel'; catCode = 'H'; idColumnInPackage = 'Hotel_ID'; }
    else if (category === 'resto') { sheetName = 'Vendors_Resto'; catCode = 'R'; idColumnInPackage = 'Meal_ID'; }
    else if (category === 'ticket') { sheetName = 'Vendors_Ticket'; catCode = 'TK'; idColumnInPackage = 'Ticket_ID'; } // Ticket_ID disiapkan utk ke depannya
    else if (category === 'other') { sheetName = 'Vendors_Other'; catCode = 'O'; idColumnInPackage = ''; } // Multiple IDs in Other_IDs
    else return;

    // Generate new nameCode
    let consonants = newName.replace(/[^a-zA-Z]/g, '').replace(/[aeiouAEIOU]/g, '').toUpperCase();
    let nameCode = consonants.substring(0, 3);
    while (nameCode.length < 3) { nameCode += 'X'; }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    
    let counter = 1;
    const idMappings = {};
    const updates = [];

    for (let i = 1; i < data.length; i++) {
        if (data[i][1] === username) {
            const oldId = data[i][0];
            const nextNum = counter.toString().padStart(3, '0');
            const newId = `${catCode}-${nameCode}-${nextNum}`;
            idMappings[oldId] = newId;
            
            updates.push({row: i + 1, value: newId});
            counter++;
        }
    }
    
    if (updates.length > 0) {
        updates.forEach(u => {
            sheet.getRange(u.row, 1).setValue(u.value);
        });
    }

    // Apply updates to Packages_Master
    if (Object.keys(idMappings).length > 0 && idColumnInPackage) {
        const pkgSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Packages_Master');
        if (pkgSheet) {
            const pkgData = pkgSheet.getDataRange().getValues();
            const headers = pkgData[0];
            const colIndex = headers.indexOf(idColumnInPackage);
            if (colIndex !== -1) {
                const pkgUpdates = [];
                for (let i = 1; i < pkgData.length; i++) {
                    const currentId = pkgData[i][colIndex];
                    if (idMappings[currentId]) {
                        pkgUpdates.push({row: i + 1, col: colIndex + 1, value: idMappings[currentId]});
                    }
                }
                if (pkgUpdates.length > 0) {
                    pkgUpdates.forEach(u => {
                        pkgSheet.getRange(u.row, u.col).setValue(u.value);
                    });
                }
            }
        }
    }
}

// Ambil Data Vendor beserta filternya
function getVendorsData(category, role, username) {
  const allUsersData = getAllUsersData(); // Mengambil info nomor hp & alamat dll

  let sheetName = '';
  switch(category) {
    case 'transport': sheetName = 'Vendors_Transport'; break;
    case 'hotel': sheetName = 'Vendors_Hotel'; break;
    case 'resto': sheetName = 'Vendors_Resto'; break;
    case 'ticket': sheetName = 'Vendors_Ticket'; break;
    case 'other': sheetName = 'Vendors_Other'; break;
    case 'all': // Khusus Admin
       if (role !== 'admin') throw new Error('Akses ditolak');
       return {
         transport: getSheetDataWithFilter('Vendors_Transport', role, username, allUsersData),
         hotel: getSheetDataWithFilter('Vendors_Hotel', role, username, allUsersData),
         resto: getSheetDataWithFilter('Vendors_Resto', role, username, allUsersData),
         ticket: getSheetDataWithFilter('Vendors_Ticket', role, username, allUsersData),
         other: getSheetDataWithFilter('Vendors_Other', role, username, allUsersData),
       };
    default: return [];
  }
  
  return getSheetDataWithFilter(sheetName, role, username, allUsersData);
}

function getAllUsersData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  
  const users = {};
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    users[data[i][0]] = obj; // Key-nya adalah Username
  }
  return users;
}

function getSheetDataWithFilter(sheetName, role, username, usersData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return []; // Kosong atau cuma header
  
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    
    // FILTERING LOGIC
    if (role === 'vendor' && obj['Username_Vendor'] !== username) {
      continue; // Skip jika bukan miliknya
    }
    
    // INJECT DATA KONTAK KE HASIL (agar admin bisa melihat)
    if (role === 'admin' && obj['Username_Vendor'] && usersData[obj['Username_Vendor']]) {
       const u = usersData[obj['Username_Vendor']];
       obj['Vendor_Name'] = u.Nama_Instansi;
       obj['Vendor_Phone'] = u.Nomor_Telepon;
       obj['Vendor_PIC'] = u.PIC;
       obj['Vendor_Address'] = u.Alamat;
       obj['Vendor_Logo'] = u.Logo_URL;
    }
    
    items.push(obj);
  }
  return items;
}


function saveVendorData(category, itemData) {
  let sheetName = '';
  switch(category) {
    case 'transport': sheetName = 'Vendors_Transport'; break;
    case 'hotel': sheetName = 'Vendors_Hotel'; break;
    case 'resto': sheetName = 'Vendors_Resto'; break;
    case 'ticket': sheetName = 'Vendors_Ticket'; break;
    case 'other': sheetName = 'Vendors_Other'; break;
    default: throw new Error('Kategori tidak valid');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet tidak ditemukan');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Cek apakah ID sudah ada (jika iya = Update, jika tidak = Insert)
  const data = sheet.getDataRange().getValues();
  let rowIndexToUpdate = -1;
  const idIndex = headers.indexOf('ID');
  const userIndex = headers.indexOf('Username_Vendor');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === itemData.ID) {
      // Pastikan yang mengupdate adalah pemiliknya
      if (data[i][userIndex] !== itemData.Username_Vendor) {
         throw new Error('Anda tidak memiliki akses untuk mengubah data ini');
      }
      rowIndexToUpdate = i + 1; // 1-indexed for Apps Script
      break;
    }
  }

  const rowData = headers.map((header, index) => {
    if (itemData[header] !== undefined) return itemData[header];
    return rowIndexToUpdate > -1 ? data[rowIndexToUpdate - 1][index] : '';
  });
  
  if (rowIndexToUpdate > -1) {
    const oldRow = data[rowIndexToUpdate - 1];
    let changes = [];
    
    // Kamus terjemahan field teknis ke bahasa manusia
    const labelMap = {
        'Price_Per_Room': 'Harga',
        'Price_Per_Pax': 'Harga',
        'Price_Per_Day': 'Harga',
        'Pax_Per_Room': 'Kapasitas Kamar',
        'Capacity': 'Kapasitas',
        'Facilities': 'Fasilitas',
        'Location': 'Lokasi',
        'Description': 'Deskripsi',
        'Category': 'Kategori',
        'Service_Type': 'Jenis Layanan',
        'Price': 'Harga',
        'Unit': 'Satuan',
        'Name': 'Nama'
    };

    const formatVal = (val) => {
        if (!isNaN(val) && val !== '' && Number(val) > 1000) {
            // Format angka sederhana dengan titik ribuan
            return 'Rp ' + Number(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
        return `"${val}"`;
    };

    for (let i = 0; i < headers.length; i++) {
        if (headers[i] !== 'Update_Date' && headers[i] !== 'ID' && String(oldRow[i]) !== String(rowData[i])) {
            const label = labelMap[headers[i]] || headers[i];
            const oldVal = formatVal(oldRow[i]);
            const newVal = formatVal(rowData[i]);
            changes.push(`${label} dari ${oldVal} menjadi ${newVal}`);
        }
    }
    
    sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).setValues([rowData]);
    if (changes.length > 0) {
        appendLog(itemData.Username_Vendor || 'Sistem', `Update Layanan ${category.toUpperCase()}`, `Merubah ${itemData.Name} (${itemData.ID}): ${changes.join(', ')}`);
    }
  } else {
    sheet.appendRow(rowData);
    appendLog(itemData.Username_Vendor || 'Sistem', `Tambah Layanan ${category.toUpperCase()}`, `Menambahkan layanan baru: ${itemData.Name} (${itemData.ID})`);
  }
  
  // Urutkan data berdasarkan Username_Vendor (Kolom ke-2) lalu ID (Kolom ke-1)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    range.sort([{column: 2, ascending: true}, {column: 1, ascending: true}]);
  }
}

function deleteVendorData(category, id, username) {
  let sheetName = '';
  switch(category) {
    case 'transport': sheetName = 'Vendors_Transport'; break;
    case 'hotel': sheetName = 'Vendors_Hotel'; break;
    case 'resto': sheetName = 'Vendors_Resto'; break;
    case 'ticket': sheetName = 'Vendors_Ticket'; break;
    case 'other': sheetName = 'Vendors_Other'; break;
    default: throw new Error('Kategori tidak valid');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet tidak ditemukan');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  
  const idIndex = headers.indexOf('ID');
  const userIndex = headers.indexOf('Username_Vendor');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      // Hanya pemilik yang bisa menghapus
      if (data[i][userIndex] !== username) {
         throw new Error('Anda tidak memiliki izin menghapus data ini');
      }
      
      const itemName = data[i][headers.indexOf('Name')] || id;
      sheet.deleteRow(i + 1);
      
      appendLog(username, `Hapus Layanan ${category.toUpperCase()}`, `Menghapus layanan: ${itemName} (${id})`);
      return;
    }
  }
  throw new Error('Data tidak ditemukan');
}

// Simpan Data Paket
function savePackage(packageData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Packages_Master');
  if (!sheet) throw new Error('Sheet Packages_Master tidak ditemukan');
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(packageData));
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const idIndex = headers.indexOf('ID');
  let rowIndexToUpdate = -1;
  const data = sheet.getDataRange().getValues();
  
  if (packageData.ID) {
     for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === packageData.ID) {
           rowIndexToUpdate = i + 1;
           break;
        }
     }
  } else {
     let maxSeq = 0;
     for (let i = 1; i < data.length; i++) {
        let idVal = data[i][idIndex];
        if (idVal && idVal.toString().startsWith('PKG-')) {
           let num = parseInt(idVal.split('-')[1]);
           if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
     }
     packageData.ID = 'PKG-' + String(maxSeq + 1).padStart(3, '0');
  }
  
  const rowData = headers.map(header => packageData[header] || '');
  
  if (rowIndexToUpdate > -1) {
    sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).setValues([rowData]);
    appendLog('Admin', 'Update Paket', `Merubah paket: ${packageData.Package_Name} (${packageData.ID})`);
  } else {
    sheet.appendRow(rowData);
    appendLog('Admin', 'Buat Paket', `Membuat paket baru: ${packageData.Package_Name} (${packageData.ID})`);
  }
}

// Hapus Data Paket
function deletePackage(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Packages_Master');
  if (!sheet) throw new Error('Sheet Packages_Master tidak ditemukan');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ID');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      const pkgName = data[i][headers.indexOf('Package_Name')] || id;
      sheet.deleteRow(i + 1);
      appendLog('Admin', 'Hapus Paket', `Menghapus paket: ${pkgName} (${id})`);
      return;
    }
  }
  throw new Error('Paket tidak ditemukan');
}

// Ambil Data Paket
function getPackagesData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Packages_Master');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    items.push(obj);
  }
  return items;
}
