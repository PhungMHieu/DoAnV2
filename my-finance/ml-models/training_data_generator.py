"""
Generate training data for transaction categorization
Combines real user data (if available) + synthetic data
"""

import json
import random
from typing import List, Dict, Tuple
from pathlib import Path


class TrainingDataGenerator:
    """
    Generate labeled training data for transaction categorization
    """

    def __init__(self):
        # Template patterns for each category
        self.templates = {
            "income": [
                "Lương tháng {month}",
                "Thưởng cuối năm",
                "Nhận tiền freelance",
                "Thu nhập từ {source}",
                "Tiền lãi ngân hàng",
                "Được trả tiền {project}",
                "Salary {month}",
                "Bonus payment",
                "Income from {source}",
            ],
            "food": [
                "{restaurant} ăn {meal}",
                "Mua {food} tại {place}",
                "GrabFood ship {food}",
                "Order {food} qua {app}",
                "Buffet {type} tại {restaurant}",
                "{meal} với {people}",
                "Cafe {place}",
                "{food} delivery",
                "Ăn {food}",
                "Uống {drink} tại {place}",
            ],
            "transport": [
                "Grab {type} {destination}",
                "Taxi đi {destination}",
                "Đổ xăng xe",
                "Vé {vehicle} {route}",
                "Gửi xe tại {place}",
                "Sửa xe {issue}",
                "Bảo dưỡng xe",
                "{app} {type} to {destination}",
                "Parking fee",
                "Bus ticket {route}",
            ],
            "entertainment": [
                "Xem phim {movie} tại {cinema}",
                "{service} subscription",
                "Vé concert {artist}",
                "Du lịch {destination}",
                "Karaoke với {people}",
                "Game {name}",
                "Spa massage",
                "{activity} vui chơi",
                "Netflix monthly",
                "Spotify premium",
            ],
            "shopping": [
                "{platform} mua {item}",
                "Order {item} online",
                "Mua {item} tại {store}",
                "Quần áo {brand}",
                "{item} from {store}",
                "Online shopping {platform}",
                "Buy {item}",
            ],
            "healthcare": [
                "Khám bệnh tại {hospital}",
                "Mua thuốc {medicine}",
                "Nha khoa {service}",
                "Xét nghiệm {test}",
                "Bảo hiểm y tế",
                "Doctor {specialty}",
                "Pharmacy {item}",
                "Medical checkup",
            ],
            "education": [
                "Học phí {course}",
                "Sách {subject}",
                "Khóa học {topic} trên {platform}",
                "{exam} exam fee",
                "Tuition {semester}",
                "Course {name}",
            ],
            "bills": [
                "Hóa đơn {utility}",
                "Tiền {service} tháng {month}",
                "{utility} bill",
                "Internet {provider}",
                "Điện nước tháng {month}",
                "Phone bill {provider}",
            ],
            "housing": [
                "Tiền nhà tháng {month}",
                "Sửa chữa {item}",
                "Mua {furniture}",
                "Rent {month}",
                "Furniture {item}",
                "Home repair {issue}",
            ],
            "personal": [
                "Cắt tóc",
                "Gym membership",
                "Quà {occasion} cho {person}",
                "Haircut {salon}",
                "Gift for {person}",
                "Donate {cause}",
            ],
            "other": [
                "{misc} expense",
                "Miscellaneous",
                "Other payment",
            ],
        }

        # Vocabulary for templates
        self.vocabulary = {
            "month": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
            "meal": ["sáng", "trưa", "tối", "lunch", "dinner", "breakfast"],
            "food": [
                "cơm", "phở", "bún", "bánh mì", "pizza", "burger", "sushi",
                "lẩu", "nướng", "gà rán", "mì", "bún bò", "cà phê",
            ],
            "drink": ["cà phê", "trà sữa", "nước ép", "coffee", "smoothie"],
            "restaurant": [
                "Phở 24", "Highlands Coffee", "Lotteria", "KFC",
                "Pizza Hut", "Starbucks", "Jollibee", "The Coffee House",
            ],
            "place": ["quán", "shop", "store", "nhà hàng", "restaurant"],
            "app": ["GrabFood", "ShopeeFood", "BeeFood", "GoFood"],
            "type": ["bike", "car", "xe máy", "ô tô"],
            "destination": ["nhà", "công ty", "sân bay", "home", "office", "airport"],
            "vehicle": ["xe buýt", "tàu", "bus", "train", "metro"],
            "route": ["1", "số 5", "route 10", "line 1"],
            "cinema": ["CGV", "Lotte", "Galaxy", "BHD"],
            "movie": ["Avatar", "Avengers", "Inception"],
            "service": ["Netflix", "Spotify", "YouTube Premium", "Disney+"],
            "platform": ["Shopee", "Lazada", "Tiki", "Sendo"],
            "item": [
                "quần áo", "giày", "điện thoại", "laptop", "đồ chơi",
                "clothes", "shoes", "phone", "accessories",
            ],
            "store": ["Vinmart", "Coopmart", "Circle K", "FPT Shop"],
            "brand": ["Nike", "Adidas", "Uniqlo", "Zara"],
            "hospital": ["bệnh viện", "phòng khám", "clinic", "hospital"],
            "medicine": ["paracetamol", "vitamin", "thuốc cảm"],
            "course": ["tiếng Anh", "lập trình", "English", "Python"],
            "topic": ["AI", "Marketing", "Design"],
            "platform": ["Udemy", "Coursera", "Edumall"],
            "exam": ["IELTS", "TOEIC", "SAT"],
            "utility": ["điện", "nước", "internet", "electricity", "water"],
            "provider": ["Viettel", "VNPT", "FPT", "Mobifone"],
            "furniture": ["bàn", "ghế", "giường", "tủ", "table", "chair"],
            "source": ["freelance", "side project", "investment"],
            "project": ["website", "app", "design"],
            "people": ["bạn", "gia đình", "đồng nghiệp", "friends", "family"],
            "activity": ["du lịch", "picnic", "shopping", "travel"],
            "artist": ["Sơn Tùng", "BTS", "Taylor Swift"],
            "issue": ["lốp", "phanh", "động cơ", "brake", "engine"],
            "occasion": ["sinh nhật", "kỷ niệm", "birthday"],
            "person": ["bạn gái", "mẹ", "bố", "mom", "dad", "girlfriend"],
            "cause": ["từ thiện", "charity"],
            "misc": ["random", "something"],
        }

    def generate_sample(self, category: str) -> str:
        """Generate a single training sample for a category"""
        template = random.choice(self.templates[category])

        # Fill in placeholders
        while "{" in template:
            start = template.index("{")
            end = template.index("}", start)
            placeholder = template[start + 1 : end]

            if placeholder in self.vocabulary:
                replacement = random.choice(self.vocabulary[placeholder])
                template = template[:start] + replacement + template[end + 1 :]
            else:
                # If vocabulary not found, remove placeholder
                template = template[:start] + template[end + 1 :]

        return template.strip()

    def generate_dataset(
        self,
        samples_per_category: int = 500,
    ) -> List[Dict[str, str]]:
        """
        Generate a balanced dataset
        Returns:
            List of {text, label} dicts
        """
        dataset = []

        for category in self.templates.keys():
            for _ in range(samples_per_category):
                text = self.generate_sample(category)
                dataset.append({"text": text, "label": category})

        # Shuffle
        random.shuffle(dataset)

        return dataset

    def save_dataset(
        self,
        output_path: str = "training_data.jsonl",
        samples_per_category: int = 500,
    ):
        """Generate and save dataset to JSONL file"""
        dataset = self.generate_dataset(samples_per_category)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            for sample in dataset:
                f.write(json.dumps(sample, ensure_ascii=False) + "\n")

        print(f"✅ Generated {len(dataset)} samples")
        print(f"📁 Saved to {output_file}")

        # Print statistics
        from collections import Counter
        label_counts = Counter([s["label"] for s in dataset])
        print("\n📊 Dataset Statistics:")
        for label, count in sorted(label_counts.items()):
            print(f"  {label}: {count} samples")


# Example usage
if __name__ == "__main__":
    generator = TrainingDataGenerator()

    # Generate dataset
    generator.save_dataset(
        output_path="data/training_data.jsonl",
        samples_per_category=500,  # 500 samples per category = 5,500 total
    )

    # Show some examples
    print("\n📝 Example Samples:")
    for category in ["food", "transport", "entertainment", "income"]:
        print(f"\n{category.upper()}:")
        for _ in range(3):
            print(f"  - {generator.generate_sample(category)}")
