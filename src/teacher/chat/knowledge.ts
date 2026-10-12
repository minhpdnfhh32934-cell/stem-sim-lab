import type { Locale } from '@/app/i18n/types';
import { useChatStore, type KnowledgeDocument } from './chatStore';

interface Note {
  id: string;
  subject: 'physics' | 'chemistry' | 'biology';
  vi: string;
  en: string;
  source: string;
  /** Scientific content: stays 'pending' until a teacher checks it (docs/DATA_REVIEW.md #14). */
  reviewStatus: 'pending' | 'verified';
}

/**
 * Short study notes so the built-in library is useful before learners import files. They were
 * written for the "Thầy AI" fork and are not yet checked by a teacher: every note is 'pending'.
 */
const STARTER: Note[] = [
  {
    id: 'physics-motion',
    subject: 'physics',
    vi: 'Chuyển động thẳng đều: x = x₀ + vt; vận tốc không đổi. Chuyển động thẳng biến đổi đều: v = v₀ + at; x = x₀ + v₀t + 1/2 at². Rơi tự do gần mặt đất là chuyển động nhanh dần đều với gia tốc g, nếu bỏ qua lực cản không khí.',
    en: 'Uniform motion: x = x₀ + vt with constant velocity. Uniform acceleration: v = v₀ + at and x = x₀ + v₀t + 1/2 at². Near Earth, free fall has acceleration g when air resistance is neglected.',
    source: 'Thư viện chủ đề Vật lý · Động học',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-newton',
    subject: 'physics',
    vi: 'Định luật II Newton: tổng lực ngoài tác dụng lên vật bằng khối lượng nhân gia tốc, ΣF = ma. Lực và gia tốc là đại lượng vectơ. Lực ma sát trượt thường được mô hình hóa bằng f = μN trong phạm vi bài toán phù hợp.',
    en: 'Newton’s second law: the net external force equals mass times acceleration, ΣF = ma. Force and acceleration are vectors. Kinetic friction is commonly modeled as f = μN when the model assumptions apply.',
    source: 'Thư viện chủ đề Vật lý · Động lực học',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-energy',
    subject: 'physics',
    vi: 'Cơ năng E = K + U. Khi chỉ có lực thế sinh công và không có tiêu hao, cơ năng được bảo toàn. Động năng K = 1/2 mv²; gần mặt đất thế năng trọng trường U = mgh. Cần nêu mốc thế năng và giả thiết của mô hình.',
    en: 'Mechanical energy E = K + U. It is conserved when only conservative forces do work and there is no dissipation. Kinetic energy is K = 1/2 mv²; near Earth gravitational potential energy is U = mgh. State the reference level and assumptions.',
    source: 'Thư viện chủ đề Vật lý · Năng lượng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-waves',
    subject: 'physics',
    vi: 'Dao động điều hòa có dạng x = A cos(ωt + φ); chu kỳ T = 2π/ω và tần số f = 1/T. Với con lắc lò xo lý tưởng, ω = √(k/m). Với con lắc đơn, T ≈ 2π√(l/g) chỉ đúng gần đúng khi góc lệch nhỏ.',
    en: 'Simple harmonic motion can be written x = A cos(ωt + φ), with T = 2π/ω and f = 1/T. An ideal mass–spring oscillator has ω = √(k/m). A simple pendulum has T ≈ 2π√(l/g) for small angles.',
    source: 'Thư viện chủ đề Vật lý · Dao động',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-projectile',
    subject: 'physics',
    vi: 'Khi bỏ qua lực cản không khí, chuyển động ném xiên tách thành chuyển động ngang đều và chuyển động thẳng đứng có gia tốc −g. Quỹ đạo là parabol trong hệ quy chiếu gần mặt đất. Tầm xa cực đại ở góc 45° chỉ khi điểm ném và điểm rơi cùng độ cao.',
    en: 'Neglecting air resistance, projectile motion separates into uniform horizontal motion and vertical motion with acceleration −g. The trajectory is parabolic near Earth. Maximum range occurs at 45° only when launch and landing heights are equal.',
    source: 'Thư viện chủ đề Vật lý · Ném xiên',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-momentum',
    subject: 'physics',
    vi: 'Động lượng p = mv. Trong hệ cô lập, tổng động lượng được bảo toàn. Xung lượng của lực bằng độ biến thiên động lượng, J = Δp. Trong va chạm đàn hồi, cả động lượng và động năng toàn phần được bảo toàn; va chạm mềm chỉ bảo toàn động lượng nếu hệ cô lập.',
    en: 'Momentum p = mv. Total momentum is conserved in an isolated system. Impulse equals the change in momentum, J = Δp. Elastic collisions conserve momentum and total kinetic energy; perfectly inelastic collisions conserve momentum when the system is isolated.',
    source: 'Thư viện chủ đề Vật lý · Động lượng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-electric',
    subject: 'physics',
    vi: 'Định luật Coulomb cho độ lớn lực giữa hai điện tích điểm trong chân không: F = k|q₁q₂|/r². Điện trường E = F/q thử. Điện trường là vectơ; tổng hợp điện trường tuân theo nguyên lí chồng chất. Trong môi trường vật chất, cần xét hằng số điện môi.',
    en: 'Coulomb’s law gives the force magnitude between point charges in vacuum: F = k|q₁q₂|/r². Electric field E = F/q_test. Fields are vectors and obey superposition. In a material medium, account for permittivity.',
    source: 'Thư viện chủ đề Vật lý · Điện trường',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-circuit',
    subject: 'physics',
    vi: 'Với đoạn mạch thuần trở ở điều kiện thích hợp, định luật Ohm là U = IR. Công suất điện P = UI = I²R = U²/R. Các công thức công suất có thể áp dụng khi phần tử mạch tuân theo định luật Ohm; cần dùng đúng giá trị hiệu dụng với dòng xoay chiều.',
    en: 'For an ohmic resistor under suitable conditions, Ohm’s law is U = IR. Electrical power is P = UI = I²R = U²/R. The resistor forms assume ohmic behavior; use RMS values for AC where appropriate.',
    source: 'Thư viện chủ đề Vật lý · Mạch điện',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-wave',
    subject: 'physics',
    vi: 'Sóng truyền năng lượng và trạng thái dao động, không mang vật chất đi theo một cách thuần túy. Hệ thức v = λf liên hệ tốc độ truyền sóng, bước sóng và tần số. Khi sóng đổi môi trường, tần số do nguồn quyết định vẫn giữ nguyên, còn tốc độ và bước sóng có thể đổi.',
    en: 'Waves transfer energy and oscillation, not bulk matter. The relation v = λf connects wave speed, wavelength and frequency. At a boundary the source frequency stays the same, while speed and wavelength may change.',
    source: 'Thư viện chủ đề Vật lý · Sóng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-heat',
    subject: 'physics',
    vi: 'Nhiệt lượng khi vật đổi nhiệt độ mà không chuyển thể thường được tính Q = mcΔT. Khi chuyển thể ở nhiệt độ không đổi, Q = mL. Các công thức này dùng nhiệt dung riêng c hoặc nhiệt nóng chảy/hóa hơi riêng L trong phạm vi chất và điều kiện xác định.',
    en: 'For a temperature change without a phase transition, heat is commonly Q = mcΔT. During a phase transition at constant temperature, Q = mL. Use the specific heat c or latent heat L for the substance and conditions in question.',
    source: 'Thư viện chủ đề Vật lý · Nhiệt học',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-solution',
    subject: 'chemistry',
    vi: 'Nồng độ mol C = n/V, với V tính bằng lít trong công thức mol/L. Khi pha loãng mà không xảy ra phản ứng hay thất thoát chất tan, số mol chất tan được bảo toàn: C₁V₁ = C₂V₂. Cần thống nhất đơn vị thể tích.',
    en: 'Molar concentration C = n/V, with V in litres for mol/L. For dilution without reaction or solute loss, solute amount is conserved: C₁V₁ = C₂V₂. Keep volume units consistent.',
    source: 'Thư viện chủ đề Hóa học · Dung dịch',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-acidbase',
    subject: 'chemistry',
    vi: 'Theo Brønsted–Lowry, axit cho proton H⁺ và bazơ nhận proton. Ở dung dịch nước loãng tại 25°C, pH = −log₁₀[H₃O⁺] và pH + pOH ≈ 14 khi tích số ion của nước bằng 10⁻¹⁴. Axit yếu phân li không hoàn toàn.',
    en: 'In Brønsted–Lowry theory, acids donate protons and bases accept them. In dilute aqueous solution at 25°C, pH = −log₁₀[H₃O⁺] and pH + pOH ≈ 14 when water’s ion product is 10⁻¹⁴. Weak acids ionize incompletely.',
    source: 'Thư viện chủ đề Hóa học · Axit và bazơ',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-redox',
    subject: 'chemistry',
    vi: 'Phản ứng oxi hóa–khử có sự thay đổi số oxi hóa. Oxi hóa là quá trình nhường electron, số oxi hóa tăng; khử là nhận electron, số oxi hóa giảm. Chất khử bị oxi hóa, còn chất oxi hóa bị khử. Cân bằng cần bảo toàn nguyên tố và điện tích.',
    en: 'A redox reaction changes oxidation numbers. Oxidation loses electrons and raises oxidation state; reduction gains electrons and lowers it. The reducing agent is oxidized and the oxidizing agent is reduced. Balancing must conserve atoms and charge.',
    source: 'Thư viện chủ đề Hóa học · Oxi hóa–khử',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-kinetics',
    subject: 'chemistry',
    vi: 'Tốc độ phản ứng biểu thị độ biến thiên nồng độ theo thời gian. Nhiệt độ, nồng độ, diện tích bề mặt và chất xúc tác có thể ảnh hưởng tốc độ. Chất xúc tác làm thay đổi con đường phản ứng và giảm năng lượng hoạt hóa, nhưng không làm đổi vị trí cân bằng cuối cùng.',
    en: 'Reaction rate describes concentration change per time. Temperature, concentration, surface area and catalysts can affect rate. A catalyst changes the reaction pathway and lowers activation energy but does not change the final equilibrium position.',
    source: 'Thư viện chủ đề Hóa học · Tốc độ phản ứng',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-organic',
    subject: 'chemistry',
    vi: 'Trong hóa hữu cơ, nhóm chức giúp phân loại hợp chất và dự đoán một phần tính chất, phản ứng. Ankan no có công thức chung CₙH₂ₙ₊₂ với mạch hở; anken mạch hở có một liên kết đôi thường có công thức CₙH₂ₙ. Cần xét cấu trúc cụ thể trước khi kết luận đồng phân hay tính chất.',
    en: 'In organic chemistry, functional groups help classify compounds and predict some properties and reactions. Acyclic alkanes have the formula CₙH₂ₙ₊₂; acyclic alkenes with one double bond commonly have CₙH₂ₙ. Inspect the actual structure before inferring isomers or reactivity.',
    source: 'Thư viện chủ đề Hóa học · Hóa hữu cơ',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-periodic',
    subject: 'chemistry',
    vi: 'Trong một chu kì, điện tích hạt nhân hiệu dụng thường tăng từ trái sang phải, làm bán kính nguyên tử có xu hướng giảm và năng lượng ion hóa có xu hướng tăng. Trong một nhóm, bán kính thường tăng từ trên xuống do tăng số lớp electron. Đây là xu hướng tổng quát, có ngoại lệ.',
    en: 'Across a period, effective nuclear charge generally rises, so atomic radius tends to decrease and ionization energy tends to increase. Down a group, radius usually increases as electron shells are added. These are broad trends with exceptions.',
    source: 'Thư viện chủ đề Hóa học · Bảng tuần hoàn',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-photosynthesis',
    subject: 'biology',
    vi: 'Quang hợp chuyển năng lượng ánh sáng thành năng lượng hóa học. Phương trình tổng quát thường viết 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ khi có ánh sáng và diệp lục. Hô hấp tế bào giải phóng năng lượng từ chất hữu cơ; hai quá trình có liên hệ nhưng không phải là phản ứng đảo ngược hoàn toàn của nhau.',
    en: 'Photosynthesis converts light energy into chemical energy. A common overall equation is 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ in the presence of light and chlorophyll. Cellular respiration releases energy from organic molecules; the processes are related but are not simply exact reverses.',
    source: 'Thư viện chủ đề Sinh học · Chuyển hóa năng lượng',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-cellcycle',
    subject: 'biology',
    vi: 'Chu kì tế bào gồm kì trung gian (G₁, S, G₂) và pha M. ADN nhân đôi ở pha S; nguyên phân phân chia nhân để tạo hai nhân con thường có bộ nhiễm sắc thể giống nhau về cơ bản. Giảm phân gồm hai lần phân bào sau một lần nhân đôi ADN, tạo giao tử đơn bội và góp phần tạo biến dị tổ hợp.',
    en: 'The cell cycle includes interphase (G₁, S, G₂) and M phase. DNA replicates in S phase; mitosis divides the nucleus to produce two daughter nuclei usually with essentially the same chromosome set. Meiosis has two divisions after one DNA replication, producing haploid gametes and contributing to genetic variation.',
    source: 'Thư viện chủ đề Sinh học · Chu kì tế bào',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-enzyme',
    subject: 'biology',
    vi: 'Enzyme là chất xúc tác sinh học, thường có tính đặc hiệu cơ chất và làm giảm năng lượng hoạt hóa. Tốc độ phản ứng enzyme chịu ảnh hưởng bởi nhiệt độ, pH, nồng độ cơ chất và chất ức chế. Biến tính có thể làm thay đổi cấu trúc không gian và mất hoạt tính.',
    en: 'Enzymes are biological catalysts, often substrate-specific, that lower activation energy. Enzyme rate depends on temperature, pH, substrate concentration and inhibitors. Denaturation can alter structure and remove activity.',
    source: 'Thư viện chủ đề Sinh học · Enzyme',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-atom',
    subject: 'chemistry',
    vi: 'Nguyên tử trung hòa có số proton bằng số electron; số khối A = Z + N, trong đó Z là số proton và N là số neutron. Các đồng vị có cùng Z nhưng khác số neutron. Electron hóa trị góp phần quyết định tính chất hóa học.',
    en: 'A neutral atom has equal numbers of protons and electrons; mass number A = Z + N, where Z is proton count and N is neutron count. Isotopes have the same Z but different neutron counts. Valence electrons help determine chemical behavior.',
    source: 'Thư viện chủ đề Hóa học · Nguyên tử',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-bond',
    subject: 'chemistry',
    vi: 'Liên kết ion hình thành từ lực hút tĩnh điện giữa các ion trái dấu; liên kết cộng hóa trị hình thành khi các nguyên tử dùng chung cặp electron. Hình học phân tử ảnh hưởng đến độ phân cực tổng thể; cần xét cả độ phân cực liên kết và tính đối xứng.',
    en: 'Ionic bonding is electrostatic attraction between oppositely charged ions; covalent bonding involves shared electron pairs. Molecular geometry affects overall polarity; consider both bond polarity and symmetry.',
    source: 'Thư viện chủ đề Hóa học · Liên kết và phân tử',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-mole',
    subject: 'chemistry',
    vi: 'Số mol n = m/M; với khí lý tưởng PV = nRT. Phương trình hóa học phải được cân bằng bảo toàn số nguyên tử mỗi nguyên tố và điện tích. Hệ số phương trình cho tỉ lệ mol, không phải tỉ lệ khối lượng.',
    en: 'Amount of substance n = m/M; an ideal gas obeys PV = nRT. A chemical equation must conserve each element’s atoms and total charge. Stoichiometric coefficients give mole ratios, not mass ratios.',
    source: 'Thư viện chủ đề Hóa học · Tính toán hóa học',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-equilibrium',
    subject: 'chemistry',
    vi: 'Ở cân bằng động, tốc độ phản ứng thuận bằng tốc độ phản ứng nghịch; nồng độ các chất vĩ mô không đổi theo thời gian. Hằng số cân bằng phụ thuộc nhiệt độ. Thêm chất hoặc thay đổi áp suất có thể làm hệ chuyển dịch nhưng không làm thay đổi K ở cùng nhiệt độ.',
    en: 'At dynamic equilibrium, forward and reverse reaction rates are equal and macroscopic concentrations remain constant. The equilibrium constant depends on temperature. Concentration or pressure changes can shift the system but do not change K at fixed temperature.',
    source: 'Thư viện chủ đề Hóa học · Cân bằng',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-cell',
    subject: 'biology',
    vi: 'Màng sinh chất có tính thấm chọn lọc. Khuếch tán là chuyển động thuần của hạt theo gradient nồng độ; thẩm thấu là sự di chuyển của nước qua màng thấm chọn lọc theo chênh lệch thế nước.',
    en: 'The plasma membrane is selectively permeable. Diffusion is net particle movement down a concentration gradient; osmosis is water movement across a selectively permeable membrane due to a water-potential difference.',
    source: 'Thư viện chủ đề Sinh học · Tế bào',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-genetics',
    subject: 'biology',
    vi: 'ADN lưu trữ thông tin di truyền. Trong phiên mã, trình tự trên mạch khuôn được dùng để tổng hợp ARN bổ sung; trong dịch mã, ribosome đọc codon trên mARN để lắp axit amin. Đột biến có thể trung tính, có hại hoặc có lợi tùy bối cảnh.',
    en: 'DNA stores genetic information. During transcription, the template strand guides synthesis of complementary RNA; during translation, ribosomes read mRNA codons to assemble amino acids. A mutation may be neutral, harmful or beneficial depending on context.',
    source: 'Thư viện chủ đề Sinh học · Sinh học phân tử',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-mendel',
    subject: 'biology',
    vi: 'Trong mô hình Mendel đơn giản, alen phân li khi tạo giao tử; các cặp alen phân li độc lập khi nằm trên các cặp nhiễm sắc thể khác nhau (hoặc tái tổ hợp đủ mạnh). Tỉ lệ kiểu hình cổ điển 3:1 cần trội hoàn toàn và các giả định lai một cặp tính trạng.',
    en: 'In a simple Mendelian model, alleles segregate into gametes; allele pairs assort independently when on different chromosome pairs (or sufficiently recombined). The classic 3:1 phenotype ratio assumes complete dominance and a single-trait cross.',
    source: 'Thư viện chủ đề Sinh học · Di truyền',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-evolution',
    subject: 'biology',
    vi: 'Tiến hóa nhỏ là sự thay đổi tần số alen và thành phần kiểu gen của quần thể qua các thế hệ. Đột biến tạo alen mới; chọn lọc tự nhiên, phiêu bạt di truyền, dòng gen và giao phối không ngẫu nhiên có thể ảnh hưởng cấu trúc quần thể theo các cách khác nhau.',
    en: 'Microevolution is a change in allele frequencies and genotype composition in a population across generations. Mutation creates new alleles; natural selection, genetic drift, gene flow and non-random mating can affect population structure in different ways.',
    source: 'Thư viện chủ đề Sinh học · Tiến hóa',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-homeostasis',
    subject: 'biology',
    vi: 'Hằng định nội môi là duy trì tương đối ổn định môi trường trong cơ thể nhờ cơ chế điều hòa. Phản hồi âm làm giảm sai lệch so với điểm chuẩn; ví dụ điều hòa đường huyết liên quan insulin và glucagon. Phản hồi dương khuếch đại quá trình trong một số trường hợp đặc biệt.',
    en: 'Homeostasis maintains a relatively stable internal environment through regulation. Negative feedback reduces deviation from a set point; blood-glucose regulation involves insulin and glucagon. Positive feedback amplifies a process in specific cases.',
    source: 'Thư viện chủ đề Sinh học · Sinh lý',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-ecology',
    subject: 'biology',
    vi: 'Tăng trưởng quần thể logistic có dạng dN/dt = rN(1 − N/K), trong đó r là tốc độ tăng trưởng nội tại và K là sức chứa môi trường. Mô hình giả định môi trường và sức chứa tương đối ổn định; quần thể thật có thể chịu nhiều yếu tố khác.',
    en: 'Logistic population growth is dN/dt = rN(1 − N/K), where r is intrinsic growth rate and K is carrying capacity. It assumes a relatively stable environment and carrying capacity; real populations face additional factors.',
    source: 'Thư viện chủ đề Sinh học · Sinh thái',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-torque',
    subject: 'physics',
    vi: 'Moment lực đối với một trục đặc trưng cho tác dụng làm quay: M = Fd, với d là cánh tay đòn (khoảng cách từ trục quay đến giá của lực). Vật rắn cân bằng khi tổng lực bằng 0 và tổng moment lực bằng 0.',
    en: 'Torque about an axis measures turning effect: M = Fd, where d is the lever arm (distance from the axis to the force line). A rigid body is in equilibrium when net force and net torque are both zero.',
    source: 'Thư viện chủ đề Vật lý · Moment lực',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-pressure',
    subject: 'physics',
    vi: 'Khối lượng riêng ρ = m/V. Áp suất p = F/S. Trong chất lỏng đứng yên, áp suất tăng theo độ sâu: p = p₀ + ρgh. Nguyên lí Pascal: áp suất tác dụng lên chất lỏng trong bình kín được truyền nguyên vẹn.',
    en: 'Density ρ = m/V. Pressure p = F/S. In a static fluid, pressure grows with depth: p = p₀ + ρgh. Pascal’s principle: pressure applied to an enclosed fluid is transmitted undiminished.',
    source: 'Thư viện chủ đề Vật lý · Áp suất',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-magnet',
    subject: 'physics',
    vi: 'Từ trường tác dụng lực từ lên điện tích chuyển động: lực Lorentz f = qvB sinα, với α là góc giữa vận tốc và cảm ứng từ. Lực này luôn vuông góc với vận tốc nên chỉ đổi hướng chuyển động, không đổi độ lớn vận tốc.',
    en: 'A magnetic field exerts a force on moving charge: the Lorentz force f = qvB sinα, where α is the angle between velocity and magnetic induction. It stays perpendicular to velocity, so it changes direction but not speed.',
    source: 'Thư viện chủ đề Vật lý · Từ trường',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-induction',
    subject: 'physics',
    vi: 'Định luật Faraday: suất điện động cảm ứng tỉ lệ với tốc độ biến thiên từ thông, ec = −ΔΦ/Δt. Định luật Lenz: dòng cảm ứng có chiều chống lại nguyên nhân sinh ra nó (dấu trừ). Từ thông Φ = NBScosα.',
    en: 'Faraday’s law: induced EMF tracks the rate of flux change, ec = −ΔΦ/Δt. Lenz’s law: the induced current opposes its cause (the minus sign). Flux Φ = NBScosα.',
    source: 'Thư viện chủ đề Vật lý · Cảm ứng điện từ',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-refraction',
    subject: 'physics',
    vi: 'Định luật khúc xạ (Snell): n₁sin i = n₂sin r. Khi ánh sáng đi từ môi trường chiết quang hơn sang kém hơn, góc tới vượt góc giới hạn igh (sin igh = n₂/n₁) thì xảy ra phản xạ toàn phần.',
    en: 'Snell’s law of refraction: n₁sin i = n₂sin r. Going from a denser to a rarer medium, incidence beyond the critical angle igh (sin igh = n₂/n₁) gives total internal reflection.',
    source: 'Thư viện chủ đề Vật lý · Khúc xạ ánh sáng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-damped',
    subject: 'physics',
    vi: 'Dao động tắt dần mất dần biên độ do ma sát/lực cản. Dao động duy trì bù đúng phần năng lượng mất. Dao động cưỡng bức chịu ngoại lực tuần hoàn; khi tần số ngoại lực bằng tần số riêng thì xảy ra cộng hưởng, biên độ đạt cực đại.',
    en: 'Damped oscillation loses amplitude to friction. Maintained oscillation replaces the lost energy. Forced oscillation follows a periodic driver; when the driving frequency matches the natural frequency, resonance gives maximum amplitude.',
    source: 'Thư viện chủ đề Vật lý · Dao động tắt dần và cộng hưởng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-standing',
    subject: 'physics',
    vi: 'Sóng dừng hình thành khi sóng tới và sóng phản xạ cùng tần số giao thoa, tạo nút (đứng yên) và bụng (dao động cực đại) xen kẽ. Trên dây hai đầu cố định, sóng dừng khi l = kλ/2 với k nguyên dương.',
    en: 'Standing waves form when incident and reflected waves of the same frequency interfere, giving alternating nodes (still) and antinodes (maximum motion). On a string fixed at both ends, l = kλ/2 with positive integer k.',
    source: 'Thư viện chủ đề Vật lý · Sóng dừng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-interference',
    subject: 'physics',
    vi: 'Giao thoa xảy ra khi hai sóng kết hợp (cùng tần số, hiệu số pha không đổi) gặp nhau: cùng pha tăng cường, ngược pha triệt tiêu. Với hai nguồn cùng pha cách nhau a, vân sáng khi hiệu đường đi bằng số nguyên lần bước sóng.',
    en: 'Interference needs two coherent waves (same frequency, constant phase difference): in phase they reinforce, out of phase they cancel. For two in-phase sources, bright fringes sit where the path difference is an integer number of wavelengths.',
    source: 'Thư viện chủ đề Vật lý · Giao thoa sóng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-ac',
    subject: 'physics',
    vi: 'Mạch RLC nối tiếp ở chế độ xác lập có tổng trở Z = √(R² + (ZL − ZC)²), với ZL = ωL và ZC = 1/(ωC). Cộng hưởng điện khi ZL = ZC, dòng hiệu dụng cực đại. Công suất trung bình P = UIcosφ.',
    en: 'A series RLC circuit in steady state has impedance Z = √(R² + (ZL − ZC)²), with ZL = ωL and ZC = 1/(ωC). Electrical resonance at ZL = ZC gives maximum RMS current. Average power P = UIcosφ.',
    source: 'Thư viện chủ đề Vật lý · Dòng điện xoay chiều',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-transformer',
    subject: 'physics',
    vi: 'Máy biến áp lí tưởng biến đổi điện áp theo tỉ số vòng dây: U₂/U₁ = N₂/N₁. Điện năng truyền tải xa dùng điện áp cao để giảm hao phí tỏa nhiệt P_hp = rP²/U² trên đường dây.',
    en: 'An ideal transformer scales voltage with the turns ratio: U₂/U₁ = N₂/N₁. Long-distance power uses high voltage to cut resistive loss P_hp = rP²/U² on the line.',
    source: 'Thư viện chủ đề Vật lý · Máy biến áp',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-photoelectric',
    subject: 'physics',
    vi: 'Thuyết photon: ánh sáng gồm các hạt năng lượng ε = hf. Hiện tượng quang điện xảy ra khi hf ≥ A (công thoát); động năng ban đầu cực đại Wđmax = hf − A. Giới hạn quang điện λ₀ = hc/A.',
    en: 'Photon theory: light comes in packets of energy ε = hf. The photoelectric effect needs hf ≥ A (work function); maximum initial kinetic energy Wđmax = hf − A. Threshold wavelength λ₀ = hc/A.',
    source: 'Thư viện chủ đề Vật lý · Lượng tử ánh sáng',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-bohr',
    subject: 'physics',
    vi: 'Mẫu Bo: electron chỉ tồn tại trên các quỹ đạo dừng có năng lượng xác định; nguyên tử phát xạ khi electron chuyển từ mức cao về mức thấp, hf = Em − En. Dãy Lyman, Balmer, Paschen ứng với mức cuối n = 1, 2, 3.',
    en: 'The Bohr model: electrons live only on stationary orbits with fixed energies; the atom emits when an electron drops levels, hf = Em − En. The Lyman, Balmer and Paschen series end at n = 1, 2 and 3.',
    source: 'Thư viện chủ đề Vật lý · Mẫu nguyên tử Bo',
    reviewStatus: 'pending',
  },
  {
    id: 'physics-nucleus',
    subject: 'physics',
    vi: 'Độ hụt khối Δm = (Zmp + Nmn) − m_hạt_nhân; năng lượng liên kết E_lk = Δmc², năng lượng liên kết riêng E_lkr = E_lk/A đặc trưng độ bền vững. Phóng xạ là quá trình biến đổi hạt nhân tự phát, tuân theo N = N₀·2^(−t/T).',
    en: 'Mass defect Δm = (Zmp + Nmn) − m_nucleus; binding energy E_lk = Δmc², and binding energy per nucleon E_lkr = E_lk/A measures stability. Radioactive decay is spontaneous with N = N₀·2^(−t/T).',
    source: 'Thư viện chủ đề Vật lý · Hạt nhân',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-isotope',
    subject: 'chemistry',
    vi: 'Các đồng vị của một nguyên tố có cùng số proton Z nhưng khác số neutron, nên khác số khối A. Nguyên tử khối trung bình tính theo tỉ lệ phần trăm: Ā = (A₁x₁ + A₂x₂ + …)/100. Kích thước nguyên tử đo bằng picomet.',
    en: 'Isotopes of an element share the proton number Z but differ in neutrons, hence in mass number A. Average atomic mass weights each isotope: Ā = (A₁x₁ + A₂x₂ + …)/100. Atomic sizes are measured in picometres.',
    source: 'Thư viện chủ đề Hóa học · Đồng vị',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-orbital',
    subject: 'chemistry',
    vi: 'Orbital nguyên tử là vùng không gian có xác suất tìm electron cao (s chứa tối đa 2, mỗi p/d/f gồm nhiều orbital). Cấu hình electron viết theo thứ tự mức năng lượng, trừ một số ngoại lệ (Cr, Cu…) lấy từ bảng dữ liệu, không suy từ quy tắc Aufbau một cách máy móc.',
    en: 'An atomic orbital is a region with high electron probability (s holds at most 2; p/d/f group several orbitals). Write configurations by energy order, except known exceptions (Cr, Cu, …) taken from data tables, never from a mechanical Aufbau rule.',
    source: 'Thư viện chủ đề Hóa học · Orbital',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-hbond',
    subject: 'chemistry',
    vi: 'Liên kết hydrogen hình thành khi H gắn với nguyên tử âm điện mạnh (F, O, N) hút với cặp electron riêng của nguyên tử âm điện khác; nó mạnh hơn tương tác van der Waals nhưng yếu hơn liên kết cộng hóa trị/ion, và giải thích nhiệt độ sôi cao bất thường của H₂O, HF, NH₃.',
    en: 'A hydrogen bond forms when H attached to a strongly electronegative atom (F, O, N) attracts another electronegative atom’s lone pair; it beats van der Waals forces but not covalent or ionic bonds, explaining the oddly high boiling points of H₂O, HF and NH₃.',
    source: 'Thư viện chủ đề Hóa học · Liên kết hydrogen',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-enthalpy',
    subject: 'chemistry',
    vi: 'Biến thiên enthalpy phản ứng ΔrH°₂₉₈ cho biết phản ứng tỏa nhiệt (âm) hay thu nhiệt (dương) ở điều kiện chuẩn. Có thể tính từ enthalpy tạo thành: ΔrH = ΣνΔfH(sản phẩm) − ΣνΔfH(chất đầu). Chất xúc tác không làm đổi ΔrH.',
    en: 'The reaction enthalpy ΔrH°₂₉₈ tells whether a reaction releases (negative) or absorbs (positive) heat at standard conditions. Compute it from formation enthalpies: ΔrH = ΣνΔfH(products) − ΣνΔfH(reactants). A catalyst does not change ΔrH.',
    source: 'Thư viện chủ đề Hóa học · Enthalpy',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-alcohol',
    subject: 'chemistry',
    vi: 'Alcohol no đơn chức có nhóm −OH gắn với carbon no (R−OH); phenol có −OH gắn trực tiếp vào vòng benzene nên tính acid mạnh hơn alcohol. Alcohol bậc I oxi hóa thành aldehyde rồi carboxylic acid; bậc II thành ketone; bậc III khó oxi hóa.',
    en: 'Saturated monohydric alcohols carry −OH on saturated carbon (R−OH); phenol’s −OH sits on benzene, making it more acidic than alcohols. Primary alcohols oxidize to aldehydes then acids; secondary to ketones; tertiary resist oxidation.',
    source: 'Thư viện chủ đề Hóa học · Alcohol và phenol',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-carbonyl',
    subject: 'chemistry',
    vi: 'Nhóm carbonyl C=O có trong aldehyde (R−CHO), ketone (R−CO−R′) và carboxylic acid (R−COOH). Aldehyde vừa oxi hóa vừa khử được (tráng bạc với AgNO₃/NH₃); acid yếu hơn acid vô cơ mạnh và phản ứng với bazơ, oxide bazơ, muối, kim loại trước H.',
    en: 'The carbonyl group C=O appears in aldehydes (R−CHO), ketones (R−CO−R′) and carboxylic acids (R−COOH). Aldehydes both oxidize and reduce (silver mirror with AgNO₃/NH₃); carboxylic acids are weaker than strong mineral acids and react with bases, basic oxides, salts and pre-hydrogen metals.',
    source: 'Thư viện chủ đề Hóa học · Carbonyl và acid',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-nitrogen',
    subject: 'chemistry',
    vi: 'Ammonia NH₃ là bazơ yếu, tạo phức với nhiều ion kim loại và là nguyên liệu phân đạm. Nitric acid HNO₃ là acid mạnh và chất oxi hóa mạnh (tạo NO₂ với kim loại thường, trừ Au, Pt). Muối nitrate nhiệt phân cho oxide, NO₂ và O₂ (trừ nitrate kiềm/kiềm thổ cho nitrite).',
    en: 'Ammonia NH₃ is a weak base, complexes many metal ions and feeds nitrogen fertilizers. Nitric acid HNO₃ is a strong acid and strong oxidizer (giving NO₂ with common metals except Au, Pt). Nitrates decompose on heating to oxide, NO₂ and O₂ (alkali and alkaline-earth nitrates give nitrites).',
    source: 'Thư viện chủ đề Hóa học · Nitrogen',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-sulfur',
    subject: 'chemistry',
    vi: 'Sulfur dioxide SO₂ vừa oxi hóa vừa khử, tan tạo H₂SO₃ yếu. Sulfuric acid đặc vừa acid mạnh vừa oxi hóa mạnh và háo nước; loãng có tính acid mạnh thông thường. Muối sulfate khó tan tiêu biểu là BaSO₄, PbSO₄.',
    en: 'Sulfur dioxide SO₂ both oxidizes and reduces, dissolving to weak H₂SO₃. Concentrated sulfuric acid is strongly acidic, strongly oxidizing and dehydrating; dilute acid behaves as an ordinary strong acid. Typical insoluble sulfates are BaSO₄ and PbSO₄.',
    source: 'Thư viện chủ đề Hóa học · Sulfur',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-ester',
    subject: 'chemistry',
    vi: 'Este RCOOR′ tạo từ acid và alcohol (phản ứng este hóa thuận nghịch, H₂SO₄ đặc xúc tác). Thủy phân trong môi trường kiềm (xà phòng hóa) cho muối và alcohol, một chiều. Chất béo là triester của glycerol và acid béo; xà phòng là muối natri/kali của acid béo.',
    en: 'Esters RCOOR′ form from acid plus alcohol (reversible esterification, conc. H₂SO₄ catalyst). Alkaline hydrolysis (saponification) gives salt plus alcohol, irreversibly. Fats are glycerol triesters of fatty acids; soap is their sodium/potassium salts.',
    source: 'Thư viện chủ đề Hóa học · Este và chất béo',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-carbohydrate',
    subject: 'chemistry',
    vi: 'Glucose và fructose là monosaccharide C₆H₁₂O₆ (glucose có nhóm aldehyde, fructose có nhóm ketone). Saccharose và maltose là disaccharide; tinh bột (amylose + amylopectin) và cellulose là polysaccharide. Tinh bột cho màu xanh tím với iodine; cellulose không thủy phân được trong cơ thể người.',
    en: 'Glucose and fructose are C₆H₁₂O₆ monosaccharides (glucose has an aldehyde group, fructose a ketone). Sucrose and maltose are disaccharides; starch (amylose + amylopectin) and cellulose are polysaccharides. Starch turns blue-violet with iodine; humans cannot digest cellulose.',
    source: 'Thư viện chủ đề Hóa học · Cacbohidrat',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-amine',
    subject: 'chemistry',
    vi: 'Amine có nhóm −NH₂ mang tính bazơ (alkyl amine mạnh hơn ammonia; aryl amine yếu hơn do cặp electron liên hợp vào vòng). Amino acid lưỡng tính, tồn tại dạng ion lưỡng cực và trùng ngưng thành peptide/protein. Protein đông tụ khi đun nóng hoặc gặp acid/bazơ nặng.',
    en: 'Amines carry basic −NH₂ (alkyl amines beat ammonia; aryl amines are weaker as the pair conjugates into the ring). Amino acids are amphoteric, exist as zwitterions and condense into peptides/proteins. Proteins coagulate on heating or with strong acids/bases.',
    source: 'Thư viện chủ đề Hóa học · Amin và protein',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-polymer',
    subject: 'chemistry',
    vi: 'Polymer trùng hợp từ monomer có liên kết bội (PE, PVC, cao su buna…) khác polymer trùng ngưng kèm sản phẩm phụ nhỏ (nilon-6,6, tơ lapsan…). Hệ số polymer hóa n cho biết số mắt xích trung bình. Tơ tự nhiên (tơ tằm, bông), tơ tổng hợp (nilon, lapsan) và tơ bán tổng hợp (visco) khác nhau về nguồn gốc.',
    en: 'Addition polymers grow from unsaturated monomers (PE, PVC, buna rubber…); condensation polymers release small by-products (nylon-6,6, lapsan…). The polymerization degree n counts average repeat units. Natural (silk, cotton), synthetic (nylon, lapsan) and semisynthetic (viscose) fibres differ by origin.',
    source: 'Thư viện chủ đề Hóa học · Polymer',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-electrochem',
    subject: 'chemistry',
    vi: 'Dãy điện hóa xếp các cặp oxi hóa–khử theo thế điện cực chuẩn tăng dần: chất oxi hóa mạnh dần từ trái sang, chất khử mạnh dần từ phải sang (quy tắc alpha). Pin Galvani biến hóa năng thành điện năng; điện phân dùng điện năng gây phản ứng không tự diễn biến, tuân theo định luật Faraday m = AIt/(nF).',
    en: 'The electrochemical series orders redox couples by rising standard potential: oxidizers strengthen leftward, reducers rightward (the alpha rule). A Galvanic cell turns chemical energy into electricity; electrolysis drives non-spontaneous reactions following Faraday’s law m = AIt/(nF).',
    source: 'Thư viện chủ đề Hóa học · Điện hóa',
    reviewStatus: 'pending',
  },
  {
    id: 'chem-metal',
    subject: 'chemistry',
    vi: 'Ăn mòn kim loại là phá hủy do tác dụng hóa học/môi trường; ăn mòn điện hóa xảy ra khi có hai điện cực khác nhau tiếp xúc qua dung dịch điện li. Bảo vệ bằng cách ly (sơn, mạ), dùng chất ức chế, hoặc bảo vệ điện hóa (anode hy sinh). Điều chế kim loại: nhiệt luyện, thủy luyện, điện phân.',
    en: 'Metal corrosion is environmental or chemical destruction; galvanic corrosion needs two different electrodes joined through an electrolyte. Protect by isolation (paint, plating), inhibitors, or cathodic protection (sacrificial anode). Extraction uses pyrometallurgy, hydrometallurgy or electrolysis.',
    source: 'Thư viện chủ đề Hóa học · Kim loại',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-virus',
    subject: 'biology',
    vi: 'Virus chưa có cấu tạo tế bào: gồm lõi acid nucleic (ADN hoặc ARN) và vỏ protein (một số có thêm vỏ ngoài). Virus chỉ nhân lên bên trong tế bào chủ bằng cách dùng máy móc của tế bào; ngoài tế bào, nó tồn tại như hạt không hoạt động.',
    en: 'Viruses are acellular: a nucleic-acid core (DNA or RNA) plus a protein coat (some with an envelope). They replicate only inside host cells using cellular machinery; outside cells they persist as inert particles.',
    source: 'Thư viện chủ đề Sinh học · Virus',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-plant-resp',
    subject: 'biology',
    vi: 'Hô hấp ở thực vật phân giải chất hữu cơ (chủ yếu glucose) để tạo ATP cho mọi hoạt động sống, diễn ra mạnh ở rễ, hạt nảy mầm và hoa. Trao đổi khí qua khí khổng ở lá và bì khổng ở thân gỗ; hô hấp sáng (quang hô hấp) ở cây C3 làm giảm hiệu suất quang hợp.',
    en: 'Plant respiration breaks down organics (mainly glucose) into ATP for all life processes, strongest in roots, germinating seeds and flowers. Gas exchange runs through leaf stomata and woody lenticels; photorespiration in C3 plants lowers photosynthetic efficiency.',
    source: 'Thư viện chủ đề Sinh học · Hô hấp thực vật',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-circulation',
    subject: 'biology',
    vi: 'Hệ tuần hoàn vận chuyển chất dinh dưỡng, khí, hormone và chất thải. Tim co bóp tạo áp lực đẩy máu; huyết áp cao nhất ở động mạch và giảm dần về tĩnh mạch. Miễn dịch dịch thể dùng kháng thể, miễn dịch tế bào dùng tế bào lympho T.',
    en: 'The circulatory system carries nutrients, gases, hormones and wastes. Heartbeats pressurize blood; pressure peaks in arteries and falls toward veins. Humoral immunity uses antibodies, cellular immunity uses T lymphocytes.',
    source: 'Thư viện chủ đề Sinh học · Tuần hoàn và miễn dịch',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-hormone-plant',
    subject: 'biology',
    vi: 'Hormone thực vật điều hòa sinh trưởng ở nồng độ rất thấp: auxin gây hướng động và ưu thế ngọn; gibberellin kích thích nảy mầm và sinh trưởng thân; cytokinin kích thích phân chia tế bào; abscisic acid gây ngủ và đóng khí khổng; ethylene thúc chín quả.',
    en: 'Plant hormones steer growth at tiny doses: auxin drives tropisms and apical dominance; gibberellin triggers germination and stem growth; cytokinin drives cell division; abscisic acid enforces dormancy and closes stomata; ethylene ripens fruit.',
    source: 'Thư viện chủ đề Sinh học · Hormone thực vật',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-reproduction',
    subject: 'biology',
    vi: 'Sinh sản vô tính tạo con giống hệt mẹ (phân đôi, nảy chồi, sinh dưỡng, nuôi cấy mô) nên nhanh nhưng ít biến dị. Sinh sản hữu tính qua giao tử và thụ tinh tạo biến dị tổ hợp, gồm thụ phấn–thụ tinh ở thực vật có hoa và các hình thức đẻ trứng/đẻ con ở động vật.',
    en: 'Asexual reproduction clones the parent (fission, budding, vegetative propagation, tissue culture): fast but nearly variation-free. Sexual reproduction via gametes and fertilization creates recombinant variation, from flowering-plant pollination to egg-laying and live birth in animals.',
    source: 'Thư viện chủ đề Sinh học · Sinh sản',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-chromosome-mutation',
    subject: 'biology',
    vi: 'Đột biến cấu trúc NST gồm mất, lặp, đảo và chuyển đoạn; đột biến số lượng gồm thể dị bội (2n±1, ví dụ Down) và đa bội. Hầu hết đột biến NST có hại vì làm mất cân bằng hệ gen, nhưng đa bội là nguồn nguyên liệu quan trọng trong tiến hóa và chọn giống thực vật.',
    en: 'Chromosome structural mutations are deletions, duplications, inversions and translocations; numerical ones are aneuploidy (2n±1, e.g. Down) and polyploidy. Most harm fitness by unbalancing the genome, but polyploidy fuels evolution and plant breeding.',
    source: 'Thư viện chủ đề Sinh học · Đột biến NST',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-linkage',
    subject: 'biology',
    vi: 'Các gen trên cùng một NST di truyền liên kết với nhau; hoán vị gen do trao đổi chéo tạo giao tử tái tổ hợp với tần số tỉ lệ khoảng cách gen (1% tái tổ hợp ≈ 1 cM). Di truyền liên kết giới tính thường cho kết quả lai thuận–nghịch khác nhau (ví dụ gen trên X).',
    en: 'Genes on one chromosome inherit together; crossing over creates recombinant gametes at a rate tracking gene distance (1% recombination ≈ 1 cM). Sex-linked inheritance usually gives different reciprocal-cross results (e.g. X-linked genes).',
    source: 'Thư viện chủ đề Sinh học · Liên kết gen',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-hardy',
    subject: 'biology',
    vi: 'Quần thể giao phối ngẫu nhiên, đủ lớn, không đột biến/chọn lọc/di–nhập cư thì tần số alen và thành phần kiểu gen không đổi qua các thế hệ: p + q = 1 và p² + 2pq + q² = 1 (định luật Hardy–Weinberg). Sai lệch khỏi cân bằng gợi ý tiến hóa đang diễn ra.',
    en: 'A large, randomly mating population without mutation, selection or migration keeps allele and genotype frequencies constant: p + q = 1 and p² + 2pq + q² = 1 (Hardy–Weinberg). Deviations hint that evolution is acting.',
    source: 'Thư viện chủ đề Sinh học · Di truyền quần thể',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-foodweb',
    subject: 'biology',
    vi: 'Chuỗi và lưới thức ăn mô tả dòng năng lượng qua các bậc dinh dưỡng (sản xuất → tiêu thụ → phân giải). Hiệu suất sinh thái giữa hai bậc chỉ khoảng 10% vì phần lớn năng lượng mất qua hô hấp và chất thải, nên chuỗi thức ăn hiếm khi quá 5–6 bậc.',
    en: 'Food chains and webs trace energy through trophic levels (producers → consumers → decomposers). Ecological efficiency between levels is only about 10% since most energy leaves as respiration and waste, so chains rarely exceed 5–6 levels.',
    source: 'Thư viện chủ đề Sinh học · Hệ sinh thái',
    reviewStatus: 'pending',
  },
  {
    id: 'bio-succession',
    subject: 'biology',
    vi: 'Diễn thế sinh thái là thay đổi tuần tự của quần xã theo thời gian, từ quần xã tiên phong đến quần xã đỉnh cực tương đối ổn định (nguyên sinh trên đất trống, thứ sinh sau nương rẫy/bỏ hoang). Con người có thể phục hồi hệ sinh thái bằng trồng rừng, làm sạch nguồn nước và bảo tồn đa dạng sinh học.',
    en: 'Ecological succession replaces communities over time, from pioneers to a relatively stable climax (primary on bare ground, secondary after disturbance). People can restore ecosystems by reforesting, cleaning water and conserving biodiversity.',
    source: 'Thư viện chủ đề Sinh học · Diễn thế và bảo tồn',
    reviewStatus: 'pending',
  },
];

const PENDING_NOTE: Record<Locale, string> = {
  vi: 'Trạng thái: ghi chú chưa được giáo viên duyệt, cần đối chiếu với sách giáo khoa.',
  en: 'Status: not yet reviewed by a teacher; check it against the textbook.',
};

export function builtinKnowledge(locale: Locale): KnowledgeDocument[] {
  return STARTER.map((n) => ({
    id: `builtin:${n.id}`,
    name: n.source,
    text: [
      locale === 'vi' ? n.vi : n.en,
      `Nguồn: ${n.source}`,
      ...(n.reviewStatus === 'pending' ? [PENDING_NOTE[locale]] : []),
    ].join('\n'),
    addedAt: 0,
  }));
}

/** How many built-in notes still wait for a teacher's review (shown in Settings). */
export function builtinPendingCount(): number {
  return STARTER.filter((n) => n.reviewStatus === 'pending').length;
}

function score(document: KnowledgeDocument, query: string): number {
  const tokens = query
    .toLocaleLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
  const body = `${document.name} ${document.text}`.toLocaleLowerCase().normalize('NFC');
  return tokens.reduce(
    (sum, token) => sum + (body.includes(token) ? Math.min(5, token.length) : 0),
    0,
  );
}

/** Keyword retrieval keeps the prompt small and records which local files informed a reply. */
export function searchKnowledge(query: string, locale: Locale, limit = 5): KnowledgeDocument[] {
  const all = [...builtinKnowledge(locale), ...useChatStore.getState().documents];
  return all
    .map((document) => ({ document, score: score(document, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ document }) => ({ ...document, text: document.text.slice(0, 6000) }));
}

const WIKI_HOSTS: Record<Locale, string> = {
  vi: 'vi.wikipedia.org',
  en: 'en.wikipedia.org',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * One short web excerpt (Vietnamese/English Wikipedia) when the device is online.
 * Always labelled as community content to check against the lesson — never mixed
 * silently with the checked library. Fails silently offline.
 */
export async function fetchWebKnowledge(
  query: string,
  locale: Locale,
): Promise<KnowledgeDocument[]> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
    const host = WIKI_HOSTS[locale];
    const api = `https://${host}/w/api.php?format=json&origin=*`;
    const found = await fetch(
      `${api}&action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!found.ok) return [];
    const results = asRecord(asRecord(await found.json())?.query)?.search;
    if (!Array.isArray(results) || results.length === 0) return [];
    const title = asRecord(results[0])?.title;
    if (typeof title !== 'string' || !title) return [];
    const page = await fetch(
      `${api}&action=query&prop=extracts&exsentences=3&explaintext&titles=${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!page.ok) return [];
    const pages = asRecord(asRecord(await page.json())?.query)?.pages;
    if (!pages || typeof pages !== 'object') return [];
    const first = Object.values(pages as Record<string, unknown>)[0];
    const extract = asRecord(first)?.extract;
    if (typeof extract !== 'string' || extract.trim().length < 40) return [];
    const label =
      locale === 'vi'
        ? `Wikipedia — ${title} (nội dung cộng đồng, cần đối chiếu với bài học)`
        : `Wikipedia — ${title} (community content, check against the lesson)`;
    return [
      {
        id: `web:${host}:${title}`,
        name: label,
        text: `${extract.trim().slice(0, 1500)}\nNguồn: ${label}`,
        addedAt: Date.now(),
      },
    ];
  } catch {
    return [];
  }
}
