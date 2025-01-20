const { useState, useEffect, useCallback } = React;

const RESPONSE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUvRHe90lOs14oPNfL3uRqN73uEgmg7L_ON2gXnCD-CuZ_FmTZDRb-rxmmZmeq4frFxh-IMcGLEfy-/pub?output=csv';

const ComputerLendingSystem = () => {
    // State variables
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [items, setItems] = useState([]);
    const [borrowedItems, setBorrowedItems] = useState({});
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedAction, setSelectedAction] = useState('השאלה');
    const [selectedItems, setSelectedItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);

    // Load CSV data
    const loadCSVData = async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            
            const result = Papa.parse(text, {
                header: false,
                skipEmptyLines: true
            });
            
            return result.data.map(row => ({
                value: row[0]
            }));
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    };

    // Load borrowed items
    const loadBorrowedItems = useCallback(async () => {
        try {
            const response = await fetch(RESPONSE_SHEET_URL);
            if (!response.ok) throw new Error('Failed to load borrowed items');
            const text = await response.text();
            const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            });

            // Create status object for each item
            const itemStatus = result.data.reduce((acc, row) => {
                if (row['שם'] && row['פריט']) {
                    acc[row['פריט']] = {
                        user: row['שם'],
                        action: row['פעולה'],
                        timestamp: row['תאריך']
                    };
                }
                return acc;
            }, {});

            setBorrowedItems(itemStatus);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Error loading borrowed items:', error);
            setError('אירעה שגיאה בטעינת נתוני ההשאלות');
        }
    }, []);

    // Initial data load
    useEffect(() => {
        const loadAllData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const [usersData, classesData, itemsData] = await Promise.all([
                    loadCSVData('https://docs.google.com/spreadsheets/d/e/2PACX-1vQUvRHe90lOs14oPNfL3uRqN73uEgmg7L_ON2gXnCD-CuZ_FmTZDRb-rxmmZmeq4frFxh-IMcGLEfy-/pub?output=csv'),
                    loadCSVData('https://docs.google.com/spreadsheets/d/e/2PACX-1vT1t6xbHD1i8uWUFQb5MmaHbjjyOLhcCdxs26f0nIABkNoGULEia-mfdsS78KlLNeZdtJ31XQEdi70C/pub?output=csv'),
                    loadCSVData('https://docs.google.com/spreadsheets/d/e/2PACX-1vQei6STuL-DPohSAnmCu8zgljKa4a2r8j4PfZYtrDUL1iV4eCc_eg-1R8VCwfKx-TYC5gS8uqQtE1B9/pub?output=csv')
                ]);

                setUsers(usersData);
                setClasses(classesData);
                setItems(itemsData);

                await loadBorrowedItems();
            } catch (error) {
                console.error('Error in loadAllData:', error);
                setError('אירעה שגיאה בטעינת הנתונים: ' + error.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadAllData();
    }, [loadBorrowedItems]);

    // Auto refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadBorrowedItems();
        }, 30000);
        
        return () => clearInterval(interval);
    }, [loadBorrowedItems]);

    // Get available items
    const getAvailableItems = useCallback(() => {
        if (selectedAction === 'השאלה') {
            return items.filter(item => {
                const status = borrowedItems[item.value];
                return !status || status.action === 'החזרה';
            });
        } else {
            return items.filter(item => {
                const status = borrowedItems[item.value];
                return status && 
                       status.user === selectedUser && 
                       status.action === 'השאלה';
            });
        }
    }, [items, borrowedItems, selectedAction, selectedUser]);

    // Reset selected items when user or action changes
    useEffect(() => {
        setSelectedItems([]);
    }, [selectedUser, selectedAction]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (submitting) return;
        
        try {
            setSubmitting(true);
            const form = new FormData();
            form.append('entry.1927360815', selectedUser);
            form.append('entry.1595080383', selectedAction);
            form.append('entry.93664657', selectedClass);
            form.append('entry.973123435', selectedItems.join(', '));
            
            await fetch('https://docs.google.com/forms/d/e/1FAIpQLSdRc_KO4IuEEQpqcl9ed1XpY0hU4gaTYBNLuw3ns5Kx6m2fVw/formResponse', {
                method: 'POST',
                body: form,
                mode: 'no-cors'
            });
            
            // Wait 30 seconds before refreshing data
            await new Promise(resolve => setTimeout(resolve, 30000));
            await loadBorrowedItems();
            
            setSelectedItems([]);
            setSelectedUser('');
            setSelectedClass('');
            alert('הטופס נשלח בהצלחה!');
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('אירעה שגיאה בשליחת הטופס: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div>טוען נתונים...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-4">
                <div className="text-red-500 mb-4">{error}</div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    נסה שוב
                </button>
            </div>
        );
    }

    const availableItems = getAvailableItems();

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center">מערכת השאלת מחשבים</h1>
            
            {lastRefresh && (
                <div className="text-center text-sm text-gray-500 mb-4">
                    עודכן לאחרונה: {new Date(lastRefresh).toLocaleTimeString()}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6 bg-white p-6 rounded-lg shadow">
                <div className="flex flex-col">
                    <label className="mb-2 font-medium">שם המשאיל:</label>
                    <select 
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="p-2 border rounded focus:border-blue-500 focus:outline-none"
                        required
                    >
                        <option value="">בחר משאיל</option>
                        {users.map((user, index) => (
                            <option key={index} value={user.value}>
                                {user.value}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="mb-2 font-medium">כיתה:</label>
                    <select 
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="p-2 border rounded focus:border-blue-500 focus:outline-none"
                        required
                    >
                        <option value="">בחר כיתה</option>
                        {classes.map((cls, index) => (
                            <option key={index} value={cls.value}>
                                {cls.value}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="mb-2 font-medium">פעולה:</label>
                    <select 
                        value={selectedAction}
                        onChange={(e) => setSelectedAction(e.target.value)}
                        className="p-2 border rounded focus:border-blue-500 focus:outline-none"
                        required
                    >
                        <option value="השאלה">השאלה</option>
                        <option value="החזרה">החזרה</option>
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="mb-2 font-medium">פריטים:</label>
                    <div className="space-y-2 border rounded p-4 max-h-48 overflow-y-auto">
                        {availableItems.length === 0 ? (
                            <div className="text-center text-gray-500">
                                {selectedAction === 'השאלה' ? 
                                    'אין פריטים זמינים להשאלה' : 
                                    selectedUser ? 
                                        'אין פריטים מושאלים למשתמש זה' :
                                        'בחר משתמש כדי לראות את הפריטים המושאלים'
                                }
                            </div>
                        ) : (
                            availableItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-end">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(item.value)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedItems([...selectedItems, item.value]);
                                                } else {
                                                    setSelectedItems(selectedItems.filter(i => i !== item.value));
                                                }
                                            }}
                                            className="w-4 h-4 ml-2"
                                        />
                                        <span>{item.value}</span>
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                    {selectedItems.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                            נבחרו {selectedItems.length} פריטים
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 disabled:bg-gray-400"
                    disabled={selectedItems.length === 0 || submitting}
                >
                    {submitting ? (
                        <div className="flex items-center justify-center">
                            <span className="mr-2">מעבד את הבקשה...</span>
                            <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
                        </div>
                    ) : (
                        'שלח טופס'
                    )}
                </button>

                {submitting && (
                    <div className="text-sm text-gray-500 text-center mt-2">
                        הנתונים מתעדכנים, אנא המתן...
                    </div>
                )}
            </form>
            
            {/* Status Display */}
            <div className="mt-8 max-w-lg mx-auto">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-lg font-medium mb-4">סטטוס נוכחי:</h2>
                    <div className="text-sm text-gray-600">
                        <div>פריטים זמינים: {items.filter(item => {
                            const status = borrowedItems[item.value];
                            return !status || status.action === 'החזרה';
                        }).length}</div>
                        <div>פריטים מושאלים: {items.filter(item => {
                            const status = borrowedItems[item.value];
                            return status && status.action === 'השאלה';
                        }).length}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ComputerLendingSystem />);
