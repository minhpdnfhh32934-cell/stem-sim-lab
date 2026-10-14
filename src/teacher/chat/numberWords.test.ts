import { describe, expect, it } from 'vitest';
import { numberWordValues } from './numberWords';
import { contextNumbers, unverifiedNumbers } from './provenance';

describe('numbers written in words', () => {
  it.each([
    ['hai giờ', 2],
    ['mười lăm phút', 15],
    ['hai mươi lăm giây', 25],
    ['hai mươi mốt ngày', 21],
    ['một trăm hai mươi mét', 120],
    ['hai trăm linh năm', 205],
    ['hai nghìn năm trăm', 2500],
    ['ba triệu', 3_000_000],
    ['hai giờ rưỡi', 2.5],
    ['nửa giờ', 0.5],
    ['tăng gấp đôi', 2],
    ['hai muoi lam giay', 25],
    ['twenty five seconds', 25],
    ['one hundred and twenty', 120],
    ['two thousand', 2000],
    ['half an hour', 0.5],
    ['twice as fast', 2],
  ])('%s gives %d', (text, value) => {
    expect(numberWordValues(text)).toContain(value);
  });

  it('reads accents: "sau" (after) is not "sáu" (six), "bốn" is four', () => {
    expect(numberWordValues('Vật dừng sau khi trượt.')).toEqual([]);
    expect(numberWordValues('sáu giây')).toEqual([6]);
    expect(numberWordValues('Có bốn lực')).toEqual([4]);
  });

  it('gives nothing for text without number words', () => {
    expect(numberWordValues('Tính quãng đường ô tô đi được.')).toEqual([]);
    expect(numberWordValues('')).toEqual([]);
  });
});

describe('real Vietnamese numerals', () => {
  it.each([
    ['hai mươi ba', 23],
    ['một trăm linh năm', 105],
    ['một trăm lẻ tư', 104],
    ['ba nghìn', 3000],
    ['hai ngàn', 2000],
    ['mười bốn', 14],
    ['mười lăm', 15],
    ['ba mươi mốt', 31],
    ['hai mươi một', 21],
    ['hai mươi tư', 24],
    ['bốn mươi lăm', 45],
    ['năm mươi nhăm', 55],
    ['năm mươi', 50],
    ['một nghìn hai trăm', 1200],
    ['hai nghìn không trăm linh năm', 2005],
    ['ba nghìn lẻ năm', 3005],
    ['hai nghìn hai mươi', 2020],
    ['hai trăm nghìn', 200_000],
    ['ba triệu hai trăm nghìn', 3_200_000],
    ['ba triệu hai nghìn', 3_002_000],
    ['một tỷ', 1e9],
    ['ba nghìn tỷ', 3e12],
    ['hai lăm phút', 25],
    ['một trăm rưỡi', 150],
    ['hai nghìn rưỡi', 2500],
    ['mười giờ rưỡi', 10.5],
    ['năm phần trăm', 5],
  ])('%s is %d, and only that', (text, value) => {
    expect(numberWordValues(text)).toEqual([value]);
  });

  it('reads fractions: "ba phần tư" is 3/4, "một phần ba" is 1/3', () => {
    expect(numberWordValues('ba phần tư quãng đường')).toEqual([0.75]);
    const third = numberWordValues('một phần ba');
    expect(third).toHaveLength(1);
    expect(third[0]).toBeCloseTo(1 / 3, 12);
    expect(numberWordValues('một phần mười hai')[0]).toBeCloseTo(1 / 12, 12);
  });

  it('reads English numerals', () => {
    expect(numberWordValues('twenty-five')).toEqual([25]);
    expect(numberWordValues('two thousand five hundred')).toEqual([2500]);
    expect(numberWordValues('one thousand and five')).toEqual([1005]);
    expect(numberWordValues('twelve hundred')).toEqual([1200]);
    expect(numberWordValues('ten seconds')).toEqual([10]);
  });
});

describe('number words are never summed', () => {
  // "năm" right after a number is the year: no 5 (five is "lăm" inside a spoken number). After
  // "trăm" or a scale word only a word that settles it keeps the year ("hai trăm năm" alone: below).
  it.each([
    ['một năm', [1]],
    ['mười năm', [10]],
    ['hai mươi năm', [20]],
    ['hai trăm năm trước', [200]],
    ['hai nghìn năm qua', [2000]],
    ['một năm hai tháng', [1, 2]],
    ['one two', [1, 2]],
  ])('%s gives %j', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });

  it('does not join words across punctuation', () => {
    expect(numberWordValues('một trăm, hai mươi')).toEqual([100, 20]);
    expect(numberWordValues('hai, bốn')).toEqual([2, 4]);
    expect(numberWordValues('hai mươi, lăm giây')).toEqual([20]);
  });
});

describe('a digit word that may end the number before it in speech: nothing counts', () => {
  it.each([
    // After a lone digit: "hai tư" 24, "ba sáu" 36, or "hai ba người" (two or three people).
    'hai tư giờ',
    'ba tư tuổi',
    'hai tư rưỡi',
    'hai bốn',
    'hai bốn giờ',
    'ba sáu',
    'hai ba người',
    'Một hai ba',
    'sinh viên năm hai',
    // After "trăm" or a scale word: "hai trăm tư" 240, "một trăm mốt" 110, "một nghìn hai" 1200.
    'hai trăm tư thế',
    'Em ra hai trăm tư có đúng không?',
    'hai trăm tư mét',
    'một nghìn tư mét',
    'hai nghìn tư',
    'một trăm mốt',
    'hai trăm hai mét',
    'một nghìn hai',
    'ba nghìn hai nghìn',
    'hai trăm năm mét',
    'hai trăm năm tư',
  ])('"%s" gives nothing (not the shorter numeral, not the digits)', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('what comes after it still counts', () => {
    expect(numberWordValues('một trăm tư nhân hai')).toEqual([2]);
    expect(numberWordValues('Một ngày có hai tư tiếng')).toEqual([1]);
  });

  it.each([
    // "trăm hai" 120, "nghìn hai" 1200 in speech; "vài nghìn hai trăm" has no 200 of its own.
    'trăm hai',
    'nghìn hai',
    'Có vài nghìn hai trăm người',
    'hundred and twenty',
  ])('"%s" gives nothing: a numeral after a bare "trăm" or scale word goes on with it', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });
});

describe('a digit word after a numeral that ends in a units digit ends a range', () => {
  it.each([
    ['mười hai ba tuổi', [12]],
    ['Em đo được khoảng mười hai ba giây', [12]],
    ['hai mươi lăm sáu độ', [25]],
    ['ba mươi bảy tám độ', [37]],
    ['hai mươi ba bốn', [23]],
    ['mười bốn sáu', [14]],
    ['mười chín hai mươi tuổi', [19]],
    ['hai lăm sáu phút', [25]],
  ])('"%s" gives %j: the first numeral, never the second digit alone', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('"năm" before a unit or a count word is five, so the numeral is unsure', () => {
  it.each([
    'bốn năm lần',
    'bốn năm ngày',
    'khoảng bốn năm mét',
    'ba năm mét',
    'bốn năm nghìn',
    'bốn năm mươi người',
    'trẻ bốn năm tuổi',
    'có bốn năm học sinh',
    'mười năm phút',
    'hai mươi năm giây',
    // After "chục", "trăm" or a scale word, "năm" with nothing to settle it: 250 in speech?
    'hai trăm năm',
    'hai nghìn năm',
    'Em ra hai trăm năm có đúng không ạ?',
    'Em ra hai trăm năm',
    'Em ra một trăm năm có đúng không?',
    'Em ra hai nghìn năm',
    'Em ra hai nghin nam',
    'hai chục năm',
  ])('"%s" gives nothing (not the first digit, not the tens or hundreds)', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it.each([
    ['hai trăm năm trước', [200]],
    ['hai nghìn năm qua', [2000]],
    ['hai trăm năm ánh sáng', [200]],
    ['hai chục năm trước', [20]],
    ['hai trăm năm rưỡi', [200.5]],
    ['bốn năm học', [4]],
    ['một năm mười tháng', [1, 10]],
    ['Sau ba năm còn lại bao nhiêu', [3]],
  ])('"%s" gives %j: the year', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('"chục" is ten; "vạn" and "tá" are not read', () => {
  it.each([
    ['hai chục mét', [20]],
    ['Một vật có khối lượng hai chục ki-lô-gam', [20]],
    ['khoảng hai chục giây', [20]],
    ['hai chục nghìn', [20_000]],
    ['hai chục rưỡi', [25]],
    ['một chục rưỡi', [15]],
    ['hai nghìn hai chục', [2020]],
    ['hai chục số', [20]],
    ['ba nghìn số', [3000]],
    ['mười hai chục', []],
    ['hai chục ba', []],
    ['hai vạn', []],
    ['hai tá trứng', []],
    ['hai vạn rưỡi', []],
  ])('"%s" gives %j', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('rough or partial numerals give nothing', () => {
  it.each([
    'Em ra hai trăm mấy mét',
    'hai mươi mấy',
    'hai trăm lẻ',
    'ba lẻ năm',
    'twenty-odd years',
    'two and a half thousand',
    'half a million',
    'a million and a half',
    'two hundred and a half',
  ])('"%s" gives nothing', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('"a hundred", "a thousand" are one hundred, one thousand', () => {
    expect(numberWordValues('a hundred and twenty')).toEqual([120]);
    expect(numberWordValues('a thousand metres')).toEqual([1000]);
    expect(numberWordValues('two and a half hours')).toEqual([2.5]);
  });
});

describe('names are not numbers', () => {
  it.each([
    'Ban Nam lan dau di xe dap',
    'Nam lan luot tha hai vat',
    'Nam thang xe dap',
    'Marie Curie nguoi Ba Lan',
    'Polonium được đặt tên theo Ba Lan',
    'Ba Lan là một nước ở châu Âu',
    'chú Bảy chạy xe',
  ])('"%s" gives nothing', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('a capitalised digit word that starts a sentence still counts', () => {
    expect(numberWordValues('anh Ba đi xe máy hai giờ')).toEqual([2]);
    expect(numberWordValues('Hai xe chạy. Ba giây sau thì gặp nhau')).toEqual([2, 3]);
    expect(numberWordValues('- Hai giờ sau')).toEqual([2]);
  });
});

describe('"năm" (also "year") and "chín" (also "ripe") alone need a unit, like "một"', () => {
  it.each([
    'Sau 3 năm còn lại bao nhiêu gam',
    'Em là sinh viên năm nhất',
    'Năm 1905 Einstein công bố thuyết tương đối',
    'Sau 2 năm rưỡi',
    'Quả chín nhờ etilen',
  ])('"%s" gives nothing', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it.each([
    ['Năm nay em học lớp mười', [10]],
    ['Chu kỳ bán rã là hai năm', [2]],
    ['Sau ba năm còn lại bao nhiêu', [3]],
    ['năm giây', [5]],
    ['năm lần', [5]],
    ['năm năm', [5]],
    ['chín giây', [9]],
    ['năm mươi', [50]],
  ])('"%s" gives %j', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('a denominator is no value of its own', () => {
  it.each([
    ['phần mười giây', []],
    ['một phần mười giây', [0.1]],
    ['Do chinh xac den mot phan muoi giay', []],
    ['nguyen phan ba lan', [3]],
    ['two thirds', []],
    ['one tenth of a second', []],
    ['one half', [0.5]],
    ['After three half-lives', [3]],
    ['half-life', []],
  ])('"%s" gives %j', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('ordinary words are not numbers', () => {
  it('"mốt", "lăm", "tư" are digits only inside a numeral', () => {
    expect(numberWordValues('Hôm nay là thứ tư')).toEqual([]);
    expect(numberWordValues('Em cần tư vấn')).toEqual([]);
    expect(numberWordValues('Ngày mốt em thi')).toEqual([]);
  });

  it('"một" alone is "a", unless a unit or measure word follows', () => {
    expect(numberWordValues('Một vật rơi tự do')).toEqual([]);
    expect(numberWordValues('Một xe chạy hai giờ')).toEqual([2]);
    expect(numberWordValues('một giây')).toEqual([1]);
    expect(numberWordValues('nguyên phân một lần')).toEqual([1]);
    expect(numberWordValues('một nửa')).toEqual([0.5]);
    expect(numberWordValues('một rưỡi')).toEqual([1.5]);
  });

  it('"đôi khi", "tỉ lệ", "triệu chứng" are not numbers', () => {
    expect(numberWordValues('Đôi khi em quên')).toEqual([]);
    expect(numberWordValues('hai tỉ lệ bằng nhau')).toEqual([2]);
    expect(numberWordValues('ba triệu chứng')).toEqual([3]);
    expect(numberWordValues('một đôi giày')).toEqual([2]);
  });
});

describe('text typed without accents', () => {
  it.each([
    'sau',
    'Vat dung sau khi truot.',
    'muoi sau',
    'hai ba',
    'bon',
    'nam',
    'tam',
    'chin',
    'muoi',
    'Hai xe gap nhau',
    'Xe di tu A den B',
    'Hay thay doi van toc',
    'khong co gi them nua',
    'bay gio vat o dau',
    'Ten cua em la Nam',
    'sau giay thu ba',
    'hai con ruoi',
    'Cho muoi tan vao nuoc',
  ])('"%s" gives nothing (ordinary words, no unit after them)', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it.each([
    ['muoi sau giay', 16],
    ['chin giay', 9],
    ['bon m/s', 4],
    ['nam %', 5],
    ['hai gio ruoi', 2.5],
    ['nua gio', 0.5],
    ['tang gap doi', 2],
    ['tang gap ba', 3],
    ['hai nghin', 2000],
    ['nguyen phan ba lan', 3],
    ['tang gap ba lan', 3],
  ])('"%s" gives %d (a unit or "gap" makes it a number)', (text, value) => {
    expect(numberWordValues(text)).toEqual([value]);
  });

  it.each([
    'Hai xe gap sau muoi giay',
    'Hai xe gap sau khi xe A dung lai',
    'hai xe gap sau',
    'Hai nguoi gap sau bay phut',
    'Hai xe gap tam muoi phut sau',
    'Hai xe se gap sau muoi lam phut, tinh van toc',
    'Em can gap sau muoi phut nua em thi',
    'tang gap sau',
    'tang gap sau lan',
    'gap bay',
    'gap tam',
    'An gap Nam',
    'an gap nam',
    'Hai xe gap mot xe tai',
    'Hai xe con gap nua khong',
    'tang gap ba so voi ban dau',
  ])('"%s" gives nothing: "gap" is also "gặp" (meet)', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('after "gap" what follows still counts', () => {
    expect(numberWordValues('Hai xe gap sau hai gio')).toEqual([2]);
    expect(numberWordValues('Sau hai giay')).toEqual([2]);
  });

  it.each([
    'Sau lan va cham vat chuyen dong',
    'Sau giay dau tien vat di duoc',
    'Sau tieng sam',
    'Sau gio hoc em lam bai',
    'Sau tuan nay thi',
    'May bay bay thang deu voi van toc 720 km/h',
    'Dat mot tam giay len ban',
    'sau gio ruoi',
  ])('"%s" gives nothing: "sau", "bay", "tam" alone do not count from a unit', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it.each([
    'Sau muoi giay',
    'Sau muoi giay, vat dat van toc bao nhieu?',
    'Sau muoi phut xe chay duoc bao xa',
    'Sau muoi lam phut thi xe dung lai',
    'Sau muoi sau giay vat dung lai',
    'Sau muoi hai giay',
    'Ho sau muoi met',
    'May bay bay muoi phut',
    'Bay muoi met thi ha canh',
    'Dung cach tam muoi met',
    'Mot bon muoi lit',
    'Sau nghin nam',
    'gap sau muoi lan',
    'tang gap bay muoi',
    'gap bon muoi lan',
  ])(
    '"%s" gives nothing: "sau", "bay", "tam", "bon" before "muoi" may be words before "mười"',
    (text) => {
      expect(numberWordValues(text)).toEqual([]);
    },
  );

  it.each([
    ['muoi bay giay', 17],
    ['hai tram sau muoi met', 260],
  ])('"%s" gives %d (inside a numeral that starts with another word)', (text, value) => {
    expect(numberWordValues(text)).toEqual([value]);
  });

  it('"le" before a digit is "lẻ" (zero), not "lệ"', () => {
    expect(numberWordValues('ba nghin le hai met')).toEqual([3002]);
    expect(numberWordValues('hai nghin le nam met')).toEqual([2005]);
    expect(numberWordValues('hai trieu le nam met')).toEqual([2_000_005]);
    expect(numberWordValues('hai ti le bang nhau')).toEqual([]);
  });
});

describe('halves', () => {
  it.each([
    ['hai năm rưỡi', [2.5]],
    ['một năm rưỡi', [1.5]],
    ['mười năm rưỡi', [10.5]],
    ['hai mươi năm rưỡi', [20.5]],
    ['hai nghìn năm rưỡi', [2000.5]],
    ['năm năm rưỡi', [5.5]],
    ['hai tháng rưỡi', [2.5]],
    ['hai nam ruoi', []],
    ['two and a half hours', [2.5]],
    ['one and a half', [1.5]],
  ])('"%s" gives %j: "năm rưỡi" right after a numeral is never 5,5', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('"tư" that starts a word is no digit, and the numeral it would end gives nothing', () => {
  it.each([
    ['hai mươi tư thế', []],
    ['mười tư vấn viên', []],
    ['ba mươi tư liệu', []],
    ['Em ra hai mươi tư thế có đúng không ạ?', []],
    ['tế bào có hai mươi tư nhân', []],
    ['hai mươi tư nhân ba', [3]],
    ['mười tư nhân sáu', [6]],
    // A lone "năm" needs a unit (it is also "year"): the learner's 5 is missed, a false alarm.
    ['mười tư nhân năm', []],
    ['một trăm lẻ tư nhân hai', [2]],
    ['ba phần tư nhân hai', [2]],
    ['ba nghìn hai mươi tư thế', []],
    ['hai nghìn lẻ tư thế', []],
    ['ba phẩy hai mươi tư thế', []],
    ['hai mươi tư nhân viên', [24]],
    ['ba mươi tư giây', [34]],
    ['một trăm lẻ tư giây', [104]],
  ])('%s gives %j', (text, values) => {
    expect(numberWordValues(text)).toEqual(values);
  });
});

describe('more unit words', () => {
  it.each([
    ['ten centimeters', 10],
    ['ten centimetres', 10],
    ['ten millimetres', 10],
    ['ten mph', 10],
    ['ten kelvin', 10],
    ['ten pascals', 10],
    ['một ki-lô-gam', 1],
    ['một xen-ti-mét', 1],
    ['mot ki lo gam', 1],
  ])('"%s" gives %d', (text, value) => {
    expect(numberWordValues(text)).toEqual([value]);
  });
});

describe('decimals in words', () => {
  it.each([
    ['ba phẩy năm mét', 3.5],
    ['ba phẩy năm', 3.5],
    ['không phẩy năm giây', 0.5],
    ['không phẩy không năm mét', 0.05],
    ['ba phẩy một bốn', 3.14],
    ['ba phẩy mười bốn', 3.14],
    ['chín phẩy tám mốt', 9.81],
    ['chín phẩy tám mươi mốt', 9.81],
    ['không phẩy không hai mươi lăm', 0.025],
    ['ba phẩy năm phần trăm', 3.5],
    ['ba phay nam met', 3.5],
    ['one point five', 1.5],
    ['zero point five', 0.5],
    ['one point two five metres', 1.25],
    ['at one point five metres', 1.5],
  ])('"%s" is %d, and only that', (text, value) => {
    expect(numberWordValues(text)).toEqual([value]);
  });

  it.each([
    'hai phẩy năm năm',
    'hai phẩy hai mươi năm',
    'ba phẩy một bốn mươi giây',
    'ba phẩy năm rưỡi',
    'At one point two cars collided',
    'Through one point two lines can be drawn',
    'From one point two forces act',
    'On one point two charges act',
    'In one point two forces meet',
  ])('"%s" gives nothing: its end is unsure', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('a unit after the digits settles "năm"; "point" without digits is no decimal', () => {
    expect(numberWordValues('hai phẩy năm năm giây')).toEqual([2.55]);
    expect(numberWordValues('two point charges')).toEqual([2]);
  });

  it('one digit after "point" counts before a unit or at the end, not before another word', () => {
    expect(numberWordValues('one point two metres')).toEqual([1.2]);
    expect(numberWordValues('The answer is one point two.')).toEqual([1.2]);
    expect(numberWordValues('one point two five lines')).toEqual([1.25]);
  });

  it('"ba phẩy không hai" is 3,02; "ba phẩy không năm" needs a unit (3,05, or 3,0 years?)', () => {
    expect(numberWordValues('ba phẩy không hai')).toEqual([3.02]);
    expect(numberWordValues('ba phẩy không năm mét')).toEqual([3.05]);
    expect(numberWordValues('ba phẩy không năm')).toEqual([]);
  });
});

describe('an invented number stays unverified (provenance)', () => {
  const unverified = (answer: string, learner: string) =>
    unverifiedNumbers(answer, contextNumbers([learner], { words: true }));

  it('the learner\'s ordinary words or digit pairs do not make it "given"', () => {
    expect(unverified('v = 6 m/s', 'Vat dung sau khi truot, tinh van toc')).toEqual(['6 m/s']);
    expect(unverified('t = 16 giây', 'Cho muoi sau do hoa tan')).toEqual(['16 giây']);
    expect(unverified('v = 7 m/s', 'Em là sinh viên năm hai, tính vận tốc')).toEqual(['7 m/s']);
    expect(unverified('t = 6 năm', 'Một năm có bao nhiêu giây?')).toEqual(['6 năm']);
  });

  it('a numeral the learner wrote still counts as given', () => {
    expect(unverified('t = 23 giây', 'Xe chạy hai mươi ba giây.')).toEqual([]);
    expect(unverified('s = 105 m', 'Quãng đường một trăm linh năm mét.')).toEqual([]);
    expect(unverified('t = 16 giây', 'xe chay muoi sau giay')).toEqual([]);
  });

  it('"sau", "bay" before a unit without accents do not make 6 or 7 given', () => {
    const collision = 'Sau lan va cham, vat chuyen dong voi van toc bao nhieu?';
    expect(unverified('v = 6 m/s', collision)).toEqual(['6 m/s']);
    expect(unverified('v = 6 m/s', 'Sau giay dau tien vat di duoc bao xa?')).toEqual(['6 m/s']);
    expect(unverified('v = 7 m/s', 'May bay bay thang deu, tinh van toc')).toEqual(['7 m/s']);
  });

  it('a "tư" that starts a word does not make the shorter numeral (or the numerator) given', () => {
    expect(unverified('Kết quả là 20 m/s.', 'hai mươi tư nhân ba')).toEqual(['20 m/s']);
    expect(unverified('20 × 3 = 60', 'Tính hai mươi tư nhân ba')).toContain('20');
    const tag = 'Em ra hai mươi tư thế có đúng không ạ?';
    expect(unverified('Kết quả đúng là 20 m/s.', tag)).toEqual(['20 m/s']);
    expect(unverified('v = 3 m/s', 'ba phần tư nhân hai bằng mấy')).toEqual(['3 m/s']);
    expect(unverified('t = 24 giây', 'Xe chạy hai mươi tư giây.')).toEqual([]);
  });

  it('"sau muoi", "bay muoi", "bon muoi" without accents do not make 60, 70, 40 given', () => {
    const after10s = 'Sau muoi giay, vat dat van toc bao nhieu?';
    expect(unverified('v = 60 m/s', after10s)).toEqual(['60 m/s']);
    const after15min = 'Sau muoi lam phut thi xe dung lai. Tinh quang duong.';
    expect(unverified('s = 65 km', after15min)).toEqual(['65 km']);
    const plane = 'May bay bay muoi phut, tinh quang duong';
    expect(unverified('s = 70 km', plane)).toEqual(['70 km']);
    expect(unverified('V = 40 L', 'Mot bon muoi lit nuoc')).toEqual(['40 L']);
  });

  it('"gap" (also "gặp", meet) before "sau", "tam" does not make 6, 60, 80 given', () => {
    const meet10s = 'Hai xe gap sau muoi giay, tinh van toc';
    expect(unverified('v = 60 m/s', meet10s)).toEqual(['60 m/s']);
    const meetAfter = 'Hai xe gap sau khi xe A dung lai. Tinh thoi gian';
    expect(unverified('t = 6 s', meetAfter)).toEqual(['6 s']);
    const meetAbout = 'Hai xe gap tam muoi phut sau khi xuat phat. Tinh van toc';
    expect(unverified('v = 80 km/h', meetAbout)).toEqual(['80 km/h']);
    const meet2h = 'Hai xe gap sau hai gio. Tinh quang duong';
    expect(unverified('s = 6 km', meet2h)).toEqual(['6 km']);
    expect(unverified('t = 2 giờ', meet2h)).toEqual([]);
  });

  it('a digit word after "trăm" or a digit does not make the shorter numeral given', () => {
    const posture = 'Em ra hai trăm tư thế có đúng không thầy?';
    expect(unverified('Đúng rồi, kết quả là 200 J.', posture)).toEqual(['200 J']);
    const metres = 'Em ra hai trăm tư mét có đúng không ạ?';
    expect(unverified('Chưa đúng, quãng đường là 200 m.', metres)).toEqual(['200 m']);
    expect(unverified('T = 2 h', 'Một ngày có hai tư tiếng, tính chu kỳ quay')).toEqual(['2 h']);
    expect(unverified('s = 200 m', 'Xe đi hai trăm hai mét')).toEqual(['200 m']);
  });

  it('"năm" that may be five does not make the shorter value given', () => {
    const answer200 = 'Em ra hai trăm năm có đúng không ạ?';
    expect(unverified('Chưa đúng, quãng đường là 200 m.', answer200)).toEqual(['200 m']);
    const answer2000 = 'Em ra hai nghìn năm có đúng không ạ?';
    expect(unverified('Đáp số là 2000 J.', answer2000)).toEqual(['2000 J']);
    const fall = 'Em đo thời gian rơi được khoảng bốn năm giây';
    expect(unverified('t = 4 s', fall)).toEqual(['4 s']);
    expect(unverified('t = 4 ngày', 'Xe dừng sau khoảng bốn năm ngày')).toEqual(['4 ngày']);
    expect(unverified('t = 10 phút', 'Xe chạy mười năm phút')).toEqual(['10 phút']);
    expect(unverified('t = 200 năm', 'Cách đây hai trăm năm trước')).toEqual([]);
  });

  it('the second half of a spoken range does not make its digit given', () => {
    const range = 'Em đo được khoảng mười hai ba giây. Tính gia tốc';
    expect(unverified('t = 3 s', range)).toEqual(['3 s']);
    expect(unverified('t = 12 s', range)).toEqual([]);
    const heat = 'Nhiệt độ khoảng hai mươi lăm sáu độ';
    expect(unverified('Δt = 6 °C', heat)).toEqual(['6 °C']);
    expect(unverified('s = 4 m', 'Vật trượt hai mươi ba bốn mét thì dừng.')).toEqual(['4 m']);
  });

  it('"hai chục" gives 20, not 2', () => {
    const mass = 'Một vật có khối lượng hai chục ki-lô-gam. Tính trọng lượng';
    expect(unverified('m = 2 kg', mass)).toEqual(['2 kg']);
    expect(unverified('m = 20 kg', mass)).toEqual([]);
    // "hai chục rưỡi" gives 25, no 2,5 (an answer's "2,5" is also read as 25 by provenance.ts).
    const half = 'Xe chạy hai chục rưỡi giây thì dừng';
    expect(numberWordValues(half)).toEqual([25]);
    expect(unverified('t = 25 s', half)).toEqual([]);
    expect(unverified('a = 2 m/s²', 'Xe chạy khoảng hai chục giây thì dừng')).toEqual(['2 m/s²']);
  });

  it('a name or a rough numeral does not make a value given', () => {
    const nam = 'Ban Nam lan luot tha roi hai vat. Tinh van toc';
    expect(unverified('v = 5 m/s', nam)).toEqual(['5 m/s']);
    const poland = 'Polonium được đặt tên theo Ba Lan. Tính khối lượng mol';
    expect(unverified('M = 3 g/mol', poland)).toEqual(['3 g/mol']);
    expect(unverified('Đúng, s = 200 m.', 'Em ra hai trăm mấy mét')).toEqual(['200 m']);
  });

  it('"năm" (year) does not make 5 given', () => {
    const decay = 'Sau 3 năm còn lại bao nhiêu gam? Biết ban đầu 40 g, chu kỳ bán rã 1 năm';
    expect(unverified('m = 5 g', decay)).toEqual(['5 g']);
    const fall = 'Năm nay em học lớp 10. Một vật rơi từ độ cao 20 m, tính thời gian rơi.';
    expect(unverified('Thời gian rơi là 5 s.', fall)).toEqual(['5 s']);
    expect(unverified('t = 5 s', 'Vật rơi trong năm giây')).toEqual([]);
  });

  it('a denominator or "half-life" does not make 10 or 0,5 given', () => {
    const tenth = 'Do chinh xac den mot phan muoi giay';
    expect(unverified('Sai số là 10 s.', tenth)).toEqual(['10 s']);
    const halfLives = 'After three half-lives, how much is left?';
    expect(unverified('m = 0.5 g', halfLives)).toEqual(['0.5 g']);
  });

  it('"one point two lines" does not make 1,2 given', () => {
    const lines = 'Through one point two lines pass. How many?';
    expect(unverified('The answer is 1.2 m.', lines)).toEqual(['1.2 m']);
    expect(unverified('s = 1.2 m', 'It moved one point two metres.')).toEqual([]);
  });

  it('"hai năm rưỡi" gives 2,5 years, not 5,5', () => {
    const question = 'Sau hai năm rưỡi còn lại bao nhiêu chất phóng xạ?';
    expect(unverified('t = 5,5 năm', question)).toEqual(['5,5 năm']);
    expect(unverified('t = 2,5 năm', question)).toEqual([]);
  });

  it('"le" zero and decimals in words count as the learner wrote them', () => {
    expect(unverified('s = 3002 m', 'quang duong ba nghin le hai met')).toEqual([]);
    expect(unverified('s = 3,5 m', 'quãng đường ba phẩy năm mét')).toEqual([]);
    expect(unverified('s = 5 m', 'quãng đường ba phẩy năm mét')).toEqual(['5 m']);
  });
});

describe('final review: "chục" adds nothing after it; a half after a long unit', () => {
  it.each([
    ['hai chục mười lăm'],
    ['hai chục ba mươi'],
    ['hai chục một trăm mét'],
    ['một chục mười hai quả'],
    ['sáu chục năm trăm'],
  ])('%s gives nothing (no sum of two numerals)', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('"hai chục nghìn" and "hai chục rưỡi" still read', () => {
    expect(numberWordValues('hai chục nghìn')).toEqual([20_000]);
    expect(numberWordValues('hai chục rưỡi')).toEqual([25]);
  });

  it.each([
    ['hai ki-lô-mét rưỡi'],
    ['Nhà em cách trường hai cây số rưỡi'],
    ['hai tiếng đồng hồ rưỡi'],
    ['hai xen-ti-mét rưỡi'],
    ['two hours and a half'],
    ['an hour and a half'],
  ])('%s gives no shorter value', (text) => {
    expect(numberWordValues(text)).toEqual([]);
  });

  it('keeps the halves it reads', () => {
    expect(numberWordValues('hai giờ rưỡi')).toEqual([2.5]);
    expect(numberWordValues('hai ký rưỡi')).toEqual([2.5]);
    expect(numberWordValues('two and a half hours')).toEqual([2.5]);
  });

  it('an invented value stays unverified', () => {
    const unverified = (answer: string, learner: string) =>
      unverifiedNumbers(answer, contextNumbers([learner], { words: true }));
    expect(
      unverified('Đúng rồi, đáp số là 35 m.', 'Em ra hai chục mười lăm có đúng không ạ?'),
    ).toEqual(['35 m']);
    expect(unverified('Quãng đường s = 2 km.', 'Nhà em cách trường hai ki-lô-mét rưỡi.')).toEqual([
      '2 km',
    ]);
    expect(unverified('The trip lasts t = 2 h.', 'The trip lasts two hours and a half.')).toEqual([
      '2 h',
    ]);
  });
});

describe('final review: ranges run together, "doi" and "tu A" without accents', () => {
  it.each([
    ['năm mươi sáu mươi km/h'],
    ['Khoảng hai mươi ba mươi người'],
    ['chừng ba mươi bốn mươi km/h'],
    ['tầm mười hai mươi phút'],
    ['Chạy hai mươi hai mươi lăm vòng'],
    ['mười hai trăm mét'],
    ['temperatures between one hundred and two hundred degrees'],
    ['between a hundred and two hundred metres'],
    ['between one thousand and two thousand metres'],
    ['two thousand and three thousand years'],
    ['doi gio sang giay'],
    ['Doi phut ra giay'],
    ['Xe chay ba muoi tu A den B'],
  ])('%s gives no joined or shorter value', (text) => {
    for (const v of numberWordValues(text)) {
      expect([
        56, 50, 60, 23, 20, 30, 34, 40, 12, 22, 25, 102, 1002, 2003, 2, 120, 15,
      ]).not.toContain(v);
    }
  });

  it('still reads the plain numerals', () => {
    expect(numberWordValues('năm mươi sáu km/h')).toEqual([56]);
    expect(numberWordValues('one hundred and twenty metres')).toEqual([120]);
    expect(numberWordValues('hai nghìn năm trăm mét')).toEqual([2500]);
    expect(numberWordValues('tang gap doi')).toEqual([2]);
  });

  it('a joined range stays unverified (provenance)', () => {
    const unverified = (answer: string, learner: string) =>
      unverifiedNumbers(answer, contextNumbers([learner], { words: true }));
    expect(unverified('v = 56 km/h', 'Xe chạy năm mươi sáu mươi km/h.')).toEqual(['56 km/h']);
    expect(unverified('T = 102 °C', 'between one hundred and two hundred degrees')).toEqual([
      '102 °C',
    ]);
  });
});
